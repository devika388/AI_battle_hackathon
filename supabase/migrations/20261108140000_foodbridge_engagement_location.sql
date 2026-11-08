begin;

alter table public.donations
  add column if not exists pickup_latitude numeric,
  add column if not exists pickup_longitude numeric;

alter table public.ngo_profiles
  add column if not exists latitude numeric,
  add column if not exists longitude numeric;

alter table public.notifications
  add column if not exists event_key text;

create unique index if not exists notifications_event_key_unique
  on public.notifications (event_key)
  where event_key is not null;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.donations'::regclass
      and conname = 'donations_pickup_coordinates_range'
  ) then
    alter table public.donations
      add constraint donations_pickup_coordinates_range check (
        (pickup_latitude is null and pickup_longitude is null)
        or (
          pickup_latitude is not null
          and pickup_longitude is not null
          and pickup_latitude between -90 and 90
          and pickup_longitude between -180 and 180
        )
      ) not valid;
  end if;
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.ngo_profiles'::regclass
      and conname = 'ngo_profiles_coordinates_range'
  ) then
    alter table public.ngo_profiles
      add constraint ngo_profiles_coordinates_range check (
        (latitude is null and longitude is null)
        or (
          latitude is not null and longitude is not null
          and latitude between -90 and 90 and longitude between -180 and 180
        )
      ) not valid;
  end if;
end;
$$;

create or replace function public.foodbridge_notify_status_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  donation_row public.donations%rowtype;
  assignment_row public.donation_assignments%rowtype;
  recipient record;
  event_title text;
  event_message text;
begin
  select d.* into donation_row
  from public.donations d
  where d.id = new.donation_id;
  select a.* into assignment_row
  from public.donation_assignments a
  where a.donation_id = new.donation_id
  order by a.assigned_at desc
  limit 1;

  event_title := case new.status
    when 'available' then 'Donation created'
    when 'matched' then 'Donation matched to your NGO'
    when 'partner_assigned' then 'Delivery partner assigned'
    when 'picked_up' then 'Food picked up'
    when 'in_transit' then 'Delivery in transit'
    when 'delivered' then 'Delivery completed'
    when 'completed' then 'Donation receipt confirmed'
    when 'ngo_confirmed_receipt' then 'NGO confirmed receipt'
    when 'rescue_search_started' then 'Community Rescue Mode activated'
    when 'rescue_blocked' then 'Donation blocked from rescue'
    when 'rescue_completed' then 'Community rescue completed'
    when 'delivery_proof_submitted' then 'Delivery proof submitted'
    else null
  end;
  if event_title is null then return new; end if;
  event_message := pg_catalog.format(
    '%s — %s',
    donation_row.food_name,
    coalesce(new.description, 'Your donation has a new status update.')
  );

  for recipient in
    select distinct target.user_id
    from (
      select dp.user_id
      from public.donor_profiles dp
      where dp.id = donation_row.donor_id
        and new.status in (
          'available', 'partner_assigned', 'picked_up', 'in_transit',
          'delivered', 'rescue_search_started', 'rescue_blocked', 'rescue_completed'
        )
      union all
      select np.user_id
      from public.ngo_profiles np
      where np.id = assignment_row.ngo_id
        and new.status in (
          'matched', 'partner_assigned', 'picked_up', 'in_transit',
          'delivered', 'completed', 'ngo_confirmed_receipt', 'delivery_proof_submitted'
        )
      union all
      select pp.user_id
      from public.partner_profiles pp
      where pp.id = assignment_row.partner_id
        and new.status in (
          'partner_assigned', 'picked_up', 'in_transit', 'delivered',
          'completed', 'ngo_confirmed_receipt', 'delivery_proof_submitted'
        )
    ) target
    where target.user_id is not null
  loop
    insert into public.notifications (user_id, title, message, event_key)
    values (
      recipient.user_id,
      event_title,
      event_message,
      'status-event:' || new.id::text || ':' || recipient.user_id::text
    )
    on conflict (event_key) where event_key is not null do nothing;
  end loop;
  return new;
end;
$$;

drop trigger if exists foodbridge_notify_status_event on public.status_events;
create trigger foodbridge_notify_status_event
after insert on public.status_events
for each row execute function public.foodbridge_notify_status_event();

drop trigger if exists foodbridge_notify_ngo_delivery on public.donation_assignments;

create or replace function public.foodbridge_notify_ngo_decline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  donor_user_id uuid;
  donation_name text;
begin
  if new.status <> 'declined' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;
  select dp.user_id, d.food_name
    into donor_user_id, donation_name
    from public.donations d
    join public.donor_profiles dp on dp.id = d.donor_id
    where d.id = new.donation_id;
  if donor_user_id is not null then
    insert into public.notifications (user_id, title, message, event_key)
    values (
      donor_user_id,
      'NGO declined donation',
      pg_catalog.format('An NGO declined "%s". It remains available for other eligible organizations.', donation_name),
      'ngo-match-declined:' || new.id::text || ':' || donor_user_id::text
    )
    on conflict (event_key) where event_key is not null do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists foodbridge_notify_ngo_decline on public.ngo_matches;
create trigger foodbridge_notify_ngo_decline
after insert or update of status on public.ngo_matches
for each row execute function public.foodbridge_notify_ngo_decline();

create or replace function public.foodbridge_notify_verification_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.verification_status is distinct from old.verification_status then
    insert into public.notifications (user_id, title, message, event_key)
    values (
      new.user_id,
      'Verification updated',
      pg_catalog.format('Your account verification status is now %s.', new.verification_status),
      'verification:' || tg_table_name || ':' || new.user_id::text || ':' ||
        old.verification_status || ':' || new.verification_status || ':' ||
        txid_current()::text
    )
    on conflict (event_key) where event_key is not null do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists foodbridge_notify_ngo_verification on public.ngo_profiles;
create trigger foodbridge_notify_ngo_verification
after update of verification_status on public.ngo_profiles
for each row execute function public.foodbridge_notify_verification_change();

drop trigger if exists foodbridge_notify_partner_verification on public.partner_profiles;
create trigger foodbridge_notify_partner_verification
after update of verification_status on public.partner_profiles
for each row execute function public.foodbridge_notify_verification_change();

create or replace function public.foodbridge_impact_report(p_user_id uuid)
returns table (
  donation_id uuid,
  food_category text,
  created_at timestamp without time zone,
  confirmed_at timestamp without time zone,
  food_saved_kg numeric,
  meals_provided bigint,
  co2_saved_kg numeric,
  ngo_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_role text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Trusted backend access is required.' using errcode = '42501';
  end if;
  select p.role into account_role
  from public.profiles p
  where p.id = p_user_id and coalesce(p.is_suspended, false) = false;
  if account_role is null then
    raise exception 'Active account not found.' using errcode = 'P0002';
  end if;

  return query
    select d.id, d.food_category::text, d.created_at::timestamp without time zone,
      (
        select max(e.updated_at)::timestamp without time zone
        from public.status_events e
        where e.donation_id = d.id and e.status = 'ngo_confirmed_receipt'
      ),
      i.food_saved_kg, i.meals_provided::bigint, i.co2_saved_kg, a.ngo_id
    from public.impact_records i
    join public.donations d on d.id = i.donation_id
    join public.donation_assignments a
      on a.donation_id = d.id and a.status = 'completed'
    where d.status = 'completed'
      and exists (
        select 1 from public.status_events e
        where e.donation_id = d.id
          and e.status = 'ngo_confirmed_receipt'
      )
      and (
        account_role = 'admin'
        or (
          account_role = 'donor'
          and exists (
            select 1 from public.donor_profiles dp
            where dp.id = d.donor_id and dp.user_id = p_user_id
          )
        )
        or (
          account_role = 'ngo'
          and exists (
            select 1 from public.ngo_profiles np
            where np.id = a.ngo_id and np.user_id = p_user_id
          )
        )
        or (
          account_role = 'delivery_partner'
          and exists (
            select 1 from public.donation_assignments pa
            join public.partner_profiles pp on pp.id = pa.partner_id
            where pa.donation_id = d.id and pp.user_id = p_user_id
          )
        )
      );
end;
$$;

create or replace function public.foodbridge_impact_totals(p_user_id uuid)
returns table (
  donations bigint,
  food_saved_kg numeric,
  meals_provided bigint,
  co2_saved_kg numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_role text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Trusted backend access is required.' using errcode = '42501';
  end if;
  select p.role into account_role
  from public.profiles p
  where p.id = p_user_id and coalesce(p.is_suspended, false) = false;
  if account_role is null then
    raise exception 'Active account not found.' using errcode = 'P0002';
  end if;

  return query
    select count(distinct i.donation_id),
      coalesce(sum(i.food_saved_kg), 0),
      coalesce(sum(i.meals_provided), 0)::bigint,
      coalesce(sum(i.co2_saved_kg), 0)
    from public.impact_records i
    join public.donations d on d.id = i.donation_id
    where d.status = 'completed'
      and exists (
        select 1 from public.donation_assignments a
        where a.donation_id = d.id and a.status = 'completed'
      )
      and exists (
        select 1 from public.status_events e
        where e.donation_id = d.id and e.status = 'ngo_confirmed_receipt'
      )
      and (
        account_role = 'admin'
        or (
          account_role = 'donor'
          and exists (
            select 1 from public.donor_profiles dp
            where dp.id = d.donor_id and dp.user_id = p_user_id
          )
        )
        or (
          account_role = 'ngo'
          and exists (
            select 1 from public.donation_assignments a
            join public.ngo_profiles np on np.id = a.ngo_id
            where a.donation_id = d.id and np.user_id = p_user_id
          )
        )
        or (
          account_role = 'delivery_partner'
          and exists (
            select 1 from public.donation_assignments a
            join public.partner_profiles pp on pp.id = a.partner_id
            where a.donation_id = d.id and pp.user_id = p_user_id
          )
        )
      );
end;
$$;

create or replace function public.foodbridge_rescue_report(p_user_id uuid)
returns table (donation_id uuid, outcome text, status text, created_at timestamp without time zone)
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_role text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Trusted backend access is required.' using errcode = '42501';
  end if;
  select p.role into account_role
  from public.profiles p
  where p.id = p_user_id and coalesce(p.is_suspended, false) = false;
  if account_role is null then
    raise exception 'Active account not found.' using errcode = 'P0002';
  end if;

  return query
    select r.donation_id, r.outcome::text, r.status::text,
      r.created_at::timestamp without time zone
    from public.rescue_requests r
    join public.donations d on d.id = r.donation_id
    where
      account_role = 'admin'
      or (
        account_role = 'donor'
        and exists (
          select 1 from public.donor_profiles dp
          where dp.id = d.donor_id and dp.user_id = p_user_id
        )
      )
      or (
        account_role = 'ngo'
        and exists (
          select 1 from public.donation_assignments a
          join public.ngo_profiles np on np.id = a.ngo_id
          where a.donation_id = d.id and np.user_id = p_user_id
        )
      )
      or (
        account_role = 'delivery_partner'
        and exists (
          select 1 from public.donation_assignments a
          join public.partner_profiles pp on pp.id = a.partner_id
          where a.donation_id = d.id and pp.user_id = p_user_id
        )
      );
end;
$$;

revoke all on function public.foodbridge_impact_report(uuid) from public, anon, authenticated;
revoke all on function public.foodbridge_rescue_report(uuid) from public, anon, authenticated;
grant execute on function public.foodbridge_impact_report(uuid) to service_role;
grant execute on function public.foodbridge_rescue_report(uuid) to service_role;

comment on column public.impact_records.co2_saved_kg is
  'Estimated value provided by the impact-recording source; FoodBridge reports it verbatim and does not apply or imply an independently validated conversion factor.';

create or replace function public.foodbridge_create_donation(
  p_donor_id uuid,
  p_food_name text,
  p_description text,
  p_food_category text,
  p_quantity numeric,
  p_quantity_unit text,
  p_pickup_address text,
  p_city text,
  p_pincode text,
  p_preparation_time timestamp without time zone,
  p_expiry_time timestamp without time zone,
  p_image_url text,
  p_pickup_latitude numeric,
  p_pickup_longitude numeric
)
returns setof public.donations
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_donation public.donations%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Trusted backend access is required.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.donor_profiles dp
    join public.profiles p on p.id = dp.user_id
    where dp.id = p_donor_id and p.role = 'donor'
      and coalesce(p.is_suspended, false) = false
  ) then
    raise exception 'Active donor access is required.' using errcode = '42501';
  end if;
  if p_quantity <= 0 or p_preparation_time is null
    or p_expiry_time <= p_preparation_time
    or p_expiry_time <= pg_catalog.now()::timestamp
  then
    raise exception 'Donation quantity, preparation, or expiry is invalid.'
      using errcode = '22023';
  end if;
  if (p_pickup_latitude is null) <> (p_pickup_longitude is null)
    or (p_pickup_latitude is not null and
      (p_pickup_latitude not between -90 and 90
       or p_pickup_longitude not between -180 and 180))
  then
    raise exception 'Pickup coordinates must be a valid latitude/longitude pair.'
      using errcode = '22023';
  end if;

  insert into public.donations (
    donor_id, food_name, description, food_category, quantity,
    quantity_unit, pickup_address, city, pincode, preparation_time,
    expiry_time, image_url, status, pickup_latitude, pickup_longitude
  ) values (
    p_donor_id, p_food_name, p_description, p_food_category, p_quantity,
    p_quantity_unit, p_pickup_address, p_city, p_pincode, p_preparation_time,
    p_expiry_time, p_image_url, 'available', p_pickup_latitude, p_pickup_longitude
  )
  returning * into created_donation;
  insert into public.status_events (donation_id, status, description)
    values (created_donation.id, 'available', 'Donation created.');
  return next created_donation;
end;
$$;

revoke all on function public.foodbridge_create_donation(
  uuid, text, text, text, numeric, text, text, text, text,
  timestamp without time zone, timestamp without time zone, text, numeric, numeric
) from public, anon, authenticated;
grant execute on function public.foodbridge_create_donation(
  uuid, text, text, text, numeric, text, text, text, text,
  timestamp without time zone, timestamp without time zone, text, numeric, numeric
) to service_role;

commit;
