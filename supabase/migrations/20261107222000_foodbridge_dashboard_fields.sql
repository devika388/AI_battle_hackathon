begin;

alter table public.donations
  add column if not exists preparation_time timestamp without time zone,
  add column if not exists city character varying,
  add column if not exists pincode character varying;

alter table public.ngo_profiles
  add column if not exists preferred_categories text[] not null default '{}',
  add column if not exists max_daily_quantity numeric,
  add column if not exists capacity_unit character varying;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.ngo_profiles'::regclass
      and conname = 'ngo_profiles_max_daily_quantity_nonnegative'
  ) then
    alter table public.ngo_profiles
      add constraint ngo_profiles_max_daily_quantity_nonnegative
      check (max_daily_quantity is null or max_daily_quantity > 0)
      not valid;
  end if;
end;
$$;

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
  p_image_url text default null
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
    raise exception 'Trusted backend access is required.'
      using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.donor_profiles dp
    join public.profiles p on p.id = dp.user_id
    where dp.id = p_donor_id
      and p.role = 'donor'
      and coalesce(p.is_suspended, false) = false
  ) then
    raise exception 'Active donor access is required.'
      using errcode = '42501';
  end if;
  if p_quantity <= 0
    or p_preparation_time is null
    or p_expiry_time <= p_preparation_time
    or p_expiry_time <= pg_catalog.now()::timestamp
  then
    raise exception 'Donation quantity, preparation, or expiry is invalid.'
      using errcode = '22023';
  end if;

  insert into public.donations (
    donor_id, food_name, description, food_category, quantity,
    quantity_unit, pickup_address, city, pincode, preparation_time,
    expiry_time, image_url, status
  ) values (
    p_donor_id, p_food_name, p_description, p_food_category, p_quantity,
    p_quantity_unit, p_pickup_address, p_city, p_pincode, p_preparation_time,
    p_expiry_time, p_image_url, 'available'
  )
  returning * into created_donation;

  insert into public.status_events (donation_id, status, description)
    values (created_donation.id, 'available', 'Donation created.');

  return next created_donation;
end;
$$;

revoke all on function public.foodbridge_create_donation(
  uuid, text, text, text, numeric, text, text, text, text,
  timestamp without time zone, timestamp without time zone, text
) from public, anon, authenticated;
grant execute on function public.foodbridge_create_donation(
  uuid, text, text, text, numeric, text, text, text, text,
  timestamp without time zone, timestamp without time zone, text
) to service_role;

create or replace function public.foodbridge_accept_donation(
  p_donation_id uuid,
  p_ngo_id uuid
)
returns table (
  assignment_id uuid,
  donation_id uuid,
  ngo_id uuid,
  status text,
  assigned_at timestamp without time zone
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  donation_row public.donations%rowtype;
  created_assignment public.donation_assignments%rowtype;
  donor_user_id uuid;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Trusted backend access is required.'
      using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.ngo_profiles np
    join public.profiles p on p.id = np.user_id
    where np.id = p_ngo_id
      and np.is_verified = true
      and p.role = 'ngo'
      and coalesce(p.is_suspended, false) = false
  ) then
    raise exception 'Verified NGO access is required.'
      using errcode = '42501';
  end if;

  select d.* into donation_row
    from public.donations d
    where d.id = p_donation_id
    for update;
  if not found then
    raise exception 'Donation not found.' using errcode = 'P0002';
  end if;
  if donation_row.status <> 'available'
    or donation_row.expiry_time is null
    or donation_row.expiry_time <= pg_catalog.now()::timestamp
  then
    raise exception 'Donation is no longer available.'
      using errcode = '55000';
  end if;
  if exists (
    select 1 from public.donation_assignments a
    where a.donation_id = p_donation_id
  ) then
    raise exception 'Donation already has an assignment.'
      using errcode = '55000';
  end if;

  update public.donations d
    set status = 'matched'
    where d.id = p_donation_id and d.status = 'available';
  if not found then
    raise exception 'Donation is no longer available.'
      using errcode = '55000';
  end if;

  insert into public.donation_assignments (donation_id, ngo_id, status)
    values (p_donation_id, p_ngo_id, 'accepted')
    returning * into created_assignment;

  if not exists (
    select 1 from public.ngo_matches nm
    where nm.donation_id = p_donation_id and nm.ngo_id = p_ngo_id
  ) then
    insert into public.ngo_matches (
      donation_id, ngo_id, match_score, match_reason, status
    ) values (
      p_donation_id,
      p_ngo_id,
      0,
      'Accepted from the verified NGO available-donations list.',
      'accepted'
    );
  else
    update public.ngo_matches nm
      set status = 'accepted'
      where nm.donation_id = p_donation_id
        and nm.ngo_id = p_ngo_id
        and nm.status = 'pending';
  end if;

  select dp.user_id into donor_user_id
    from public.donor_profiles dp
    where dp.id = donation_row.donor_id;
  if donor_user_id is not null then
    insert into public.notifications (user_id, title, message)
      values (
        donor_user_id,
        'Donation accepted',
        pg_catalog.format('Your donation "%s" has been accepted by an NGO.', donation_row.food_name)
      );
  end if;
  insert into public.status_events (donation_id, status, description)
    values (p_donation_id, 'matched', 'Accepted by a verified NGO.');

  return query
    select created_assignment.id, created_assignment.donation_id,
      created_assignment.ngo_id, created_assignment.status,
      created_assignment.assigned_at;
end;
$$;

create or replace function public.foodbridge_confirm_ngo_receipt(
  p_assignment_id uuid,
  p_ngo_id uuid
)
returns table (assignment_id uuid, donation_id uuid, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  assignment_row public.donation_assignments%rowtype;
  donation_name text;
  donor_user_id uuid;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Trusted backend access is required.'
      using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.ngo_profiles np
    join public.profiles p on p.id = np.user_id
    where np.id = p_ngo_id
      and np.is_verified = true
      and p.role = 'ngo'
      and coalesce(p.is_suspended, false) = false
  ) then
    raise exception 'Verified NGO access is required.'
      using errcode = '42501';
  end if;

  select a.* into assignment_row
    from public.donation_assignments a
    where a.id = p_assignment_id and a.ngo_id = p_ngo_id
    for update;
  if not found then
    raise exception 'Assignment not found.' using errcode = 'P0002';
  end if;
  if assignment_row.status <> 'delivered' then
    raise exception 'Only delivered assignments can be confirmed.'
      using errcode = '55000';
  end if;

  update public.donation_assignments a
    set status = 'completed'
    where a.id = p_assignment_id;
  update public.donations d
    set status = 'completed'
    where d.id = assignment_row.donation_id;
  insert into public.status_events (donation_id, status, description)
    values (assignment_row.donation_id, 'completed', 'Receipt confirmed by NGO.');

  select d.food_name into donation_name
    from public.donations d
    where d.id = assignment_row.donation_id;
  select dp.user_id into donor_user_id
    from public.donations d
    join public.donor_profiles dp on dp.id = d.donor_id
    where d.id = assignment_row.donation_id;
  if donor_user_id is not null then
    insert into public.notifications (user_id, title, message)
      values (
        donor_user_id,
        'Donation received',
        pg_catalog.format('The NGO confirmed receipt of "%s".', donation_name)
      );
  end if;

  return query
    select assignment_row.id, assignment_row.donation_id, 'completed'::text;
end;
$$;

revoke all on function public.foodbridge_accept_donation(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.foodbridge_accept_donation(uuid, uuid)
  to service_role;
revoke all on function public.foodbridge_confirm_ngo_receipt(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.foodbridge_confirm_ngo_receipt(uuid, uuid)
  to service_role;

create or replace function public.foodbridge_decline_donation(
  p_donation_id uuid,
  p_ngo_id uuid
)
returns table (match_id uuid, donation_id uuid, ngo_id uuid, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  donation_row public.donations%rowtype;
  existing_match_id uuid;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Trusted backend access is required.'
      using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.ngo_profiles np
    join public.profiles p on p.id = np.user_id
    where np.id = p_ngo_id
      and np.is_verified = true
      and p.role = 'ngo'
      and coalesce(p.is_suspended, false) = false
  ) then
    raise exception 'Verified NGO access is required.'
      using errcode = '42501';
  end if;

  select d.* into donation_row
    from public.donations d
    where d.id = p_donation_id
    for update;
  if not found then
    raise exception 'Donation not found.' using errcode = 'P0002';
  end if;
  if donation_row.status <> 'available'
    or donation_row.expiry_time is null
    or donation_row.expiry_time <= pg_catalog.now()::timestamp
  then
    raise exception 'Donation is no longer available.'
      using errcode = '55000';
  end if;

  select nm.id into existing_match_id
    from public.ngo_matches nm
    where nm.donation_id = p_donation_id and nm.ngo_id = p_ngo_id
    for update;
  if existing_match_id is null then
    insert into public.ngo_matches (
      donation_id, ngo_id, match_score, match_reason, status
    ) values (
      p_donation_id, p_ngo_id, 0,
      'Declined by this NGO from its available donations list.',
      'declined'
    )
    returning id into existing_match_id;
  else
    update public.ngo_matches nm
      set status = 'declined'
      where nm.id = existing_match_id
        and nm.status in ('pending', 'declined');
    if not found then
      raise exception 'This match has already been handled.'
        using errcode = '55000';
    end if;
  end if;

  return query
    select existing_match_id, p_donation_id, p_ngo_id, 'declined'::text;
end;
$$;

revoke all on function public.foodbridge_decline_donation(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.foodbridge_decline_donation(uuid, uuid)
  to service_role;

commit;
