begin;

alter table public.status_events
  add column if not exists responsible_user_id uuid,
  add column if not exists location text;

alter table public.rescue_requests
  add column if not exists reason text,
  add column if not exists outcome text,
  add column if not exists escalation_level integer not null default 0,
  add column if not exists notified_ngo_ids uuid[] not null default '{}',
  add column if not exists last_notified_at timestamp without time zone,
  add column if not exists resolution_notes text;

alter table public.donation_assignments
  add column if not exists estimated_duration_minutes integer;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.donation_assignments'::regclass
      and conname = 'donation_assignments_estimated_duration_minutes_range'
  ) then
    alter table public.donation_assignments
      add constraint donation_assignments_estimated_duration_minutes_range
      check (
        estimated_duration_minutes is null
        or estimated_duration_minutes between 1 and 720
      )
      not valid;
  end if;
end;
$$;

create index if not exists status_events_donation_chronology_idx
  on public.status_events (donation_id, updated_at);

create index if not exists rescue_requests_open_created_idx
  on public.rescue_requests (status, created_at desc);

create or replace function public.foodbridge_enrich_status_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  donation_row public.donations%rowtype;
  assignment_row public.donation_assignments%rowtype;
  event_user_id uuid;
  event_location text;
begin
  select d.* into donation_row
  from public.donations d
  where d.id = new.donation_id;
  if not found then
    raise exception 'Status event donation was not found.' using errcode = '23503';
  end if;

  select a.* into assignment_row
  from public.donation_assignments a
  where a.donation_id = new.donation_id
  order by a.assigned_at desc
  limit 1;

  if new.responsible_user_id is null then
    if new.status in ('available', 'ngo_matching_started', 'cancelled') then
      select dp.user_id into event_user_id
      from public.donor_profiles dp
      where dp.id = donation_row.donor_id;
    else
      if found then
        if new.status in ('completed', 'ngo_confirmed_receipt') then
          select np.user_id into event_user_id
          from public.ngo_profiles np
          where np.id = assignment_row.ngo_id;
        elsif new.status in (
          'matched', 'accepted', 'partner_assigned', 'pickup_started',
          'picked_up', 'in_transit', 'arrived', 'delivered',
          'delivery_proof_submitted'
        ) then
          if new.status in ('matched', 'accepted') then
            select np.user_id into event_user_id
            from public.ngo_profiles np
            where np.id = assignment_row.ngo_id;
          else
            select pp.user_id into event_user_id
            from public.partner_profiles pp
            where pp.id = assignment_row.partner_id;
          end if;
        end if;
      end if;
    end if;
    new.responsible_user_id := event_user_id;
  end if;

  if new.location is null then
    if new.status in (
      'arrived', 'delivered', 'completed', 'ngo_confirmed_receipt',
      'rescue_completed', 'delivery_proof_submitted'
    )
      and assignment_row.ngo_id is not null then
      select coalesce(nullif(np.address, ''), np.city)
        into event_location
        from public.ngo_profiles np
        where np.id = assignment_row.ngo_id;
    elsif new.status = 'in_transit' then
      event_location := null;
    else
      event_location := coalesce(nullif(donation_row.pickup_address, ''), donation_row.city);
    end if;
    new.location := event_location;
  end if;
  return new;
end;
$$;

drop trigger if exists foodbridge_enrich_status_event on public.status_events;
create trigger foodbridge_enrich_status_event
before insert on public.status_events
for each row execute function public.foodbridge_enrich_status_event();

create or replace function public.foodbridge_prevent_status_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Donation timeline events are append-only.'
    using errcode = '55000';
  return null;
end;
$$;

drop trigger if exists foodbridge_prevent_status_event_mutation on public.status_events;
create trigger foodbridge_prevent_status_event_mutation
before update or delete on public.status_events
for each row execute function public.foodbridge_prevent_status_event_mutation();

create or replace function public.foodbridge_track_assignment_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_status text;
  event_description text;
begin
  if new.partner_id is not null and old.partner_id is distinct from new.partner_id then
    event_status := 'partner_assigned';
    event_description := pg_catalog.format(
      'A delivery partner accepted the assignment with an estimated travel time of %s minutes; a 30-minute handoff buffer was applied.',
      new.estimated_duration_minutes
    );
  elsif new.delivery_stage is distinct from old.delivery_stage then
    if new.delivery_stage = 'pickup_started' then
      event_status := 'pickup_started';
    elsif new.delivery_stage = 'in_transit' then
      event_status := 'in_transit';
    elsif new.delivery_stage = 'arrived' then
      event_status := 'arrived';
    elsif new.delivery_stage = 'proof_submitted' then
      event_status := 'delivery_proof_submitted';
    end if;
    if event_status is not null then
      event_description := pg_catalog.format(
        'Delivery partner updated the journey to %s.',
        pg_catalog.replace(event_status, '_', ' ')
      );
    end if;
  end if;

  if event_status is not null then
    insert into public.status_events (donation_id, status, description)
      values (new.donation_id, event_status, event_description);
  end if;
  return new;
end;
$$;

drop trigger if exists foodbridge_track_assignment_event on public.donation_assignments;
create trigger foodbridge_track_assignment_event
after update of partner_id, delivery_stage on public.donation_assignments
for each row execute function public.foodbridge_track_assignment_event();

create or replace function public.foodbridge_enforce_handling_window()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  donation_row public.donations%rowtype;
begin
  if new.status = 'matched' and old.status is distinct from new.status then
    select d.* into donation_row
    from public.donations d
    where d.id = new.id;
    if donation_row.expiry_time is null
      or donation_row.expiry_time <= pg_catalog.now()::timestamp + interval '2 hours'
      or donation_row.preparation_time is null
      or donation_row.preparation_time > pg_catalog.now()::timestamp
    then
      raise exception 'Donation handling window or preparation time is uncertain or insufficient.'
        using errcode = '55000';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists foodbridge_enforce_handling_window on public.donations;
create trigger foodbridge_enforce_handling_window
before update of status on public.donations
for each row execute function public.foodbridge_enforce_handling_window();

create or replace function public.foodbridge_enforce_partner_handling_window()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  donation_row public.donations%rowtype;
begin
  if new.partner_id is not null and old.partner_id is distinct from new.partner_id then
    select d.* into donation_row
    from public.donations d
    where d.id = new.donation_id;
    if donation_row.expiry_time is null
      or donation_row.expiry_time <= pg_catalog.now()::timestamp + interval '2 hours'
      or donation_row.preparation_time is null
      or donation_row.preparation_time > pg_catalog.now()::timestamp
    then
      raise exception 'Donation handling window or preparation time is uncertain or insufficient.'
        using errcode = '55000';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists foodbridge_enforce_partner_handling_window on public.donation_assignments;
create trigger foodbridge_enforce_partner_handling_window
before update of partner_id on public.donation_assignments
for each row execute function public.foodbridge_enforce_partner_handling_window();

drop function if exists public.foodbridge_accept_assignment(uuid, uuid);

create function public.foodbridge_accept_assignment(
  p_assignment_id uuid,
  p_partner_id uuid,
  p_estimated_duration_minutes integer
)
returns table (
  assignment_id uuid,
  donation_id uuid,
  partner_id uuid,
  status text,
  assigned_at timestamp without time zone
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_assignment public.donation_assignments%rowtype;
  donation_status text;
  donation_expiry timestamp without time zone;
  preparation_time timestamp without time zone;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Trusted backend access is required.'
      using errcode = '42501';
  end if;
  if p_estimated_duration_minutes is null
    or p_estimated_duration_minutes < 1
    or p_estimated_duration_minutes > 720
  then
    raise exception 'Provide an estimated delivery time between 1 and 720 minutes.'
      using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.partner_profiles pp
    join public.profiles p on p.id = pp.user_id
    where pp.id = p_partner_id
      and pp.availability = true
      and p.role = 'delivery_partner'
      and coalesce(p.is_suspended, false) = false
  ) then
    raise exception 'Approved, available delivery partner access is required.'
      using errcode = '42501';
  end if;

  select a.* into current_assignment
  from public.donation_assignments a
  where a.id = p_assignment_id
  for update;
  if not found or current_assignment.partner_id is not null
    or current_assignment.status <> 'accepted'
  then
    raise exception 'Assignment is no longer available.'
      using errcode = '55000';
  end if;

  select d.status, d.expiry_time, d.preparation_time
    into donation_status, donation_expiry, preparation_time
    from public.donations d
    where d.id = current_assignment.donation_id
    for update;
  if not found or donation_status <> 'matched'
    or donation_expiry is null
    or preparation_time is null
    or preparation_time > pg_catalog.now()::timestamp
    or donation_expiry <= pg_catalog.now()::timestamp
      + interval '1 minute' * (p_estimated_duration_minutes + 30)
  then
    raise exception 'Estimated travel time and a 30-minute handoff buffer do not fit before the donor-provided expiry.'
      using errcode = '55000';
  end if;

  update public.donation_assignments a
    set partner_id = p_partner_id,
        estimated_duration_minutes = p_estimated_duration_minutes,
        status = 'assigned'
    where a.id = p_assignment_id
      and a.partner_id is null
      and a.status = 'accepted'
    returning * into current_assignment;
  if not found then
    raise exception 'Assignment is no longer available.'
      using errcode = '55000';
  end if;

  update public.donations d
    set status = 'assigned'
    where d.id = current_assignment.donation_id
      and d.status = 'matched'
      and d.expiry_time > pg_catalog.now()::timestamp;
  if not found then
    raise exception 'Donation is no longer available for delivery.'
      using errcode = '55000';
  end if;

  return query
    select current_assignment.id, current_assignment.donation_id,
      current_assignment.partner_id, current_assignment.status,
      current_assignment.assigned_at;
end;
$$;

revoke all on function public.foodbridge_accept_assignment(uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.foodbridge_accept_assignment(uuid, uuid, integer)
  to service_role;

commit;
