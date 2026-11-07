begin;

alter table public.profiles
  add column if not exists is_suspended boolean not null default false;

create or replace function public.foodbridge_current_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select profiles.role
  from public.profiles
  where profiles.id = (select auth.uid())
    and coalesce(profiles.is_suspended, false) = false
$$;

create or replace function public.foodbridge_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.foodbridge_current_role() = 'admin', false)
$$;

create or replace function public.foodbridge_is_verified_ngo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.ngo_profiles
    where ngo_profiles.user_id = (select auth.uid())
      and ngo_profiles.is_verified = true
  )
  and public.foodbridge_current_role() = 'ngo'
$$;

create or replace function public.foodbridge_owns_donor(p_donor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.donor_profiles
    where donor_profiles.id = p_donor_id
      and donor_profiles.user_id = (select auth.uid())
  )
  and public.foodbridge_current_role() = 'donor'
$$;

create or replace function public.foodbridge_owns_ngo(p_ngo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.ngo_profiles
    where ngo_profiles.id = p_ngo_id
      and ngo_profiles.user_id = (select auth.uid())
  )
  and public.foodbridge_current_role() = 'ngo'
$$;

create or replace function public.foodbridge_owns_partner(p_partner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.partner_profiles
    where partner_profiles.id = p_partner_id
      and partner_profiles.user_id = (select auth.uid())
  )
  and public.foodbridge_current_role() = 'delivery_partner'
$$;

create or replace function public.foodbridge_can_view_donation(p_donation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.foodbridge_is_admin()
    or exists (
      select 1
      from public.donations d
      join public.donor_profiles dp on dp.id = d.donor_id
      where d.id = p_donation_id
        and dp.user_id = (select auth.uid())
        and public.foodbridge_current_role() = 'donor'
    )
    or (
      public.foodbridge_is_verified_ngo()
      and exists (
        select 1
        from public.donations d
        where d.id = p_donation_id
          and (
            (d.status = 'available' and d.expiry_time > pg_catalog.now()::timestamp)
            or exists (
              select 1
              from public.donation_assignments a
              join public.ngo_profiles np on np.id = a.ngo_id
              where a.donation_id = d.id
                and np.user_id = (select auth.uid())
            )
          )
      )
    )
    or exists (
      select 1
      from public.donation_assignments a
      join public.partner_profiles pp on pp.id = a.partner_id
      where a.donation_id = p_donation_id
        and pp.user_id = (select auth.uid())
        and public.foodbridge_current_role() = 'delivery_partner'
    )
$$;

create or replace function public.foodbridge_can_view_assignment(p_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.foodbridge_is_admin()
    or exists (
      select 1
      from public.donation_assignments a
      left join public.ngo_profiles np on np.id = a.ngo_id
      left join public.partner_profiles pp on pp.id = a.partner_id
      where a.id = p_assignment_id
        and (
          (
            np.user_id = (select auth.uid())
            and public.foodbridge_is_verified_ngo()
          )
          or (
            pp.user_id = (select auth.uid())
            and public.foodbridge_current_role() = 'delivery_partner'
          )
        )
    )
    or exists (
      select 1
      from public.donation_assignments a
      join public.donations d on d.id = a.donation_id
      join public.donor_profiles dp on dp.id = d.donor_id
      where a.id = p_assignment_id
        and dp.user_id = (select auth.uid())
        and public.foodbridge_current_role() = 'donor'
    )
    or exists (
      select 1
      from public.donation_assignments a
      join public.partner_profiles pp
        on pp.user_id = (select auth.uid())
        and pp.availability = true
      where a.id = p_assignment_id
        and a.partner_id is null
        and a.status = 'accepted'
        and public.foodbridge_current_role() = 'delivery_partner'
    )
$$;

create or replace function public.foodbridge_can_access_proof_path(
  p_assignment_id text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.foodbridge_is_admin()
    or exists (
      select 1
      from public.donation_assignments a
      join public.partner_profiles pp on pp.id = a.partner_id
      where a.id::text = p_assignment_id
        and pp.user_id = (select auth.uid())
        and public.foodbridge_current_role() = 'delivery_partner'
    )
$$;

create or replace function public.foodbridge_can_view_proof_path(
  p_assignment_id text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.donation_assignments a
    where a.id::text = p_assignment_id
      and public.foodbridge_can_view_assignment(a.id)
  )
$$;

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
  donation_status text;
  donation_expiry timestamp without time zone;
  created_assignment public.donation_assignments%rowtype;
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

  select d.status, d.expiry_time
    into donation_status, donation_expiry
    from public.donations d
    where d.id = p_donation_id
    for update;
  if not found then
    raise exception 'Donation not found.' using errcode = 'P0002';
  end if;
  if donation_status <> 'available'
    or donation_expiry is null
    or donation_expiry <= pg_catalog.now()::timestamp
  then
    raise exception 'Donation is no longer available.'
      using errcode = '55000';
  end if;
  if exists (
    select 1
    from public.donation_assignments a
    where a.donation_id = p_donation_id
  ) then
    raise exception 'Donation already has an assignment.'
      using errcode = '55000';
  end if;

  update public.donations as d
    set status = 'matched'
    where d.id = p_donation_id and d.status = 'available';
  if not found then
    raise exception 'Donation is no longer available.'
      using errcode = '55000';
  end if;

  insert into public.donation_assignments (donation_id, ngo_id, status)
    values (p_donation_id, p_ngo_id, 'accepted')
    returning * into created_assignment;

  update public.ngo_matches
    set status = 'accepted'
    where donation_id = p_donation_id
      and ngo_id = p_ngo_id
      and status = 'pending';

  insert into public.status_events (donation_id, status, description)
    values (p_donation_id, 'matched', 'Accepted by a verified NGO.');

  return query
    select created_assignment.id, created_assignment.donation_id,
      created_assignment.ngo_id, created_assignment.status,
      created_assignment.assigned_at;
end;
$$;

create or replace function public.foodbridge_accept_assignment(
  p_assignment_id uuid,
  p_partner_id uuid
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
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Trusted backend access is required.'
      using errcode = '42501';
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

  select a.*
    into current_assignment
    from public.donation_assignments a
    where a.id = p_assignment_id
    for update;
  if not found then
    raise exception 'Assignment not found.' using errcode = 'P0002';
  end if;
  if current_assignment.partner_id is not null
    or current_assignment.status <> 'accepted'
  then
    raise exception 'Assignment is no longer available.'
      using errcode = '55000';
  end if;

  select d.status, d.expiry_time
    into donation_status, donation_expiry
    from public.donations d
    where d.id = current_assignment.donation_id
    for update;
  if not found
    or donation_status <> 'matched'
    or donation_expiry is null
    or donation_expiry <= pg_catalog.now()::timestamp
  then
    raise exception 'Donation is no longer available for delivery.'
      using errcode = '55000';
  end if;

  update public.donation_assignments as a
    set partner_id = p_partner_id, status = 'assigned'
    where a.id = p_assignment_id
      and a.partner_id is null
      and a.status = 'accepted'
    returning * into current_assignment;
  if not found then
    raise exception 'Assignment is no longer available.'
      using errcode = '55000';
  end if;

  update public.donations as d
    set status = 'assigned'
    where d.id = current_assignment.donation_id
      and d.status = 'matched'
      and d.expiry_time > pg_catalog.now()::timestamp;
  if not found then
    raise exception 'Donation is no longer available for delivery.'
      using errcode = '55000';
  end if;

  insert into public.status_events (donation_id, status, description)
    values (
      current_assignment.donation_id,
      'assigned',
      'Accepted by a verified delivery partner.'
    );

  return query
    select current_assignment.id, current_assignment.donation_id,
      current_assignment.partner_id, current_assignment.status,
      current_assignment.assigned_at;
end;
$$;

create or replace function public.foodbridge_update_delivery_status(
  p_assignment_id uuid,
  p_partner_id uuid,
  p_status text,
  p_description text default null
)
returns table (
  assignment_id uuid,
  donation_id uuid,
  partner_id uuid,
  status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_assignment public.donation_assignments%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Trusted backend access is required.'
      using errcode = '42501';
  end if;
  if p_status not in ('picked_up', 'delivered') then
    raise exception 'Unsupported delivery status.'
      using errcode = '22023';
  end if;

  select a.*
    into current_assignment
    from public.donation_assignments a
    where a.id = p_assignment_id
      and a.partner_id = p_partner_id
    for update;
  if not found then
    raise exception 'Assignment not found.' using errcode = 'P0002';
  end if;
  if (p_status = 'picked_up' and current_assignment.status <> 'assigned')
    or (p_status = 'delivered' and current_assignment.status <> 'picked_up')
  then
    raise exception 'Delivery status transition is not allowed.'
      using errcode = '55000';
  end if;
  if p_status = 'delivered' and not exists (
    select 1
    from public.delivery_proofs dp
    where dp.assignment_id = p_assignment_id
  ) then
    raise exception 'Upload delivery proof before marking delivery complete.'
      using errcode = '55000';
  end if;

  update public.donation_assignments as a
    set status = p_status
    where a.id = p_assignment_id
    returning * into current_assignment;
  update public.donations as d
    set status = p_status
    where d.id = current_assignment.donation_id;
  insert into public.status_events (donation_id, status, description)
    values (
      current_assignment.donation_id,
      p_status,
      nullif(pg_catalog.btrim(p_description), '')
    );

  return query
    select current_assignment.id, current_assignment.donation_id,
      current_assignment.partner_id, current_assignment.status;
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
  if p_quantity <= 0 or p_expiry_time <= pg_catalog.now()::timestamp then
    raise exception 'Donation quantity or expiry is invalid.'
      using errcode = '22023';
  end if;

  insert into public.donations (
    donor_id, food_name, description, food_category, quantity,
    quantity_unit, pickup_address, expiry_time, image_url, status
  ) values (
    p_donor_id, p_food_name, p_description, p_food_category, p_quantity,
    p_quantity_unit, p_pickup_address, p_expiry_time, p_image_url, 'available'
  )
  returning * into created_donation;

  insert into public.status_events (donation_id, status, description)
    values (created_donation.id, 'available', 'Donation created.');

  return next created_donation;
end;
$$;

create or replace function public.foodbridge_cancel_donation(
  p_donation_id uuid,
  p_donor_id uuid
)
returns table (donation_id uuid, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Trusted backend access is required.'
      using errcode = '42501';
  end if;
  update public.donations as d
    set status = 'cancelled'
    where d.id = p_donation_id
      and d.donor_id = p_donor_id
      and d.status = 'available'
    returning d.status into current_status;
  if not found then
    raise exception 'Only an owned available donation can be cancelled.'
      using errcode = '55000';
  end if;
  insert into public.status_events (donation_id, status, description)
    values (p_donation_id, 'cancelled', 'Cancelled by donor.');
  return query select p_donation_id, current_status;
end;
$$;

create or replace function public.foodbridge_set_account_suspension(
  p_admin_user_id uuid,
  p_target_user_id uuid,
  p_is_suspended boolean
)
returns table (user_id uuid, role text, is_suspended boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_role text;
  active_admin_count bigint;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Trusted backend access is required.'
      using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(706240118);
  if not exists (
    select 1
    from public.profiles p
    where p.id = p_admin_user_id
      and p.role = 'admin'
      and coalesce(p.is_suspended, false) = false
  ) then
    raise exception 'Active administrator access is required.'
      using errcode = '42501';
  end if;
  if p_is_suspended and p_admin_user_id = p_target_user_id then
    raise exception 'An administrator cannot suspend their own account.'
      using errcode = '55000';
  end if;

  select p.role into target_role
    from public.profiles p
    where p.id = p_target_user_id
    for update;
  if not found then
    raise exception 'User not found.' using errcode = 'P0002';
  end if;
  if p_is_suspended and target_role = 'admin' then
    select count(*) into active_admin_count
      from public.profiles p
      where p.role = 'admin'
        and coalesce(p.is_suspended, false) = false;
    if active_admin_count <= 1 then
      raise exception 'The last active administrator cannot be suspended.'
        using errcode = '55000';
    end if;
  end if;

  update public.profiles
    set is_suspended = p_is_suspended
    where id = p_target_user_id;
  return query select p_target_user_id, target_role, p_is_suspended;
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
    raise exception 'Trusted backend access is required.'
      using errcode = '42501';
  end if;
  select p.role into account_role
    from public.profiles p
    where p.id = p_user_id
      and coalesce(p.is_suspended, false) = false;
  if account_role is null then
    raise exception 'Active account not found.' using errcode = 'P0002';
  end if;

  return query
    select
      count(distinct i.donation_id),
      coalesce(sum(i.food_saved_kg), 0),
      coalesce(sum(i.meals_provided), 0),
      coalesce(sum(i.co2_saved_kg), 0)
    from public.impact_records i
    join public.donations d on d.id = i.donation_id
    where account_role = 'admin'
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

revoke all on function public.foodbridge_current_role() from public, anon;
revoke all on function public.foodbridge_is_admin() from public, anon;
revoke all on function public.foodbridge_is_verified_ngo() from public, anon;
revoke all on function public.foodbridge_owns_donor(uuid) from public, anon;
revoke all on function public.foodbridge_owns_ngo(uuid) from public, anon;
revoke all on function public.foodbridge_owns_partner(uuid) from public, anon;
revoke all on function public.foodbridge_can_view_donation(uuid) from public, anon;
revoke all on function public.foodbridge_can_view_assignment(uuid) from public, anon;
revoke all on function public.foodbridge_can_access_proof_path(text) from public, anon;
revoke all on function public.foodbridge_can_view_proof_path(text) from public, anon;
grant execute on function public.foodbridge_current_role() to authenticated, service_role;
grant execute on function public.foodbridge_is_admin() to authenticated, service_role;
grant execute on function public.foodbridge_is_verified_ngo() to authenticated, service_role;
grant execute on function public.foodbridge_owns_donor(uuid) to authenticated, service_role;
grant execute on function public.foodbridge_owns_ngo(uuid) to authenticated, service_role;
grant execute on function public.foodbridge_owns_partner(uuid) to authenticated, service_role;
grant execute on function public.foodbridge_can_view_donation(uuid) to authenticated, service_role;
grant execute on function public.foodbridge_can_view_assignment(uuid) to authenticated, service_role;
grant execute on function public.foodbridge_can_access_proof_path(text) to authenticated, service_role;
grant execute on function public.foodbridge_can_view_proof_path(text) to authenticated, service_role;

revoke all on function public.foodbridge_accept_donation(uuid, uuid) from public, anon, authenticated;
revoke all on function public.foodbridge_accept_assignment(uuid, uuid) from public, anon, authenticated;
revoke all on function public.foodbridge_update_delivery_status(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.foodbridge_create_donation(uuid, text, text, text, numeric, text, text, timestamp without time zone, text) from public, anon, authenticated;
revoke all on function public.foodbridge_cancel_donation(uuid, uuid) from public, anon, authenticated;
revoke all on function public.foodbridge_set_account_suspension(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.foodbridge_impact_totals(uuid) from public, anon, authenticated;
grant execute on function public.foodbridge_accept_donation(uuid, uuid) to service_role;
grant execute on function public.foodbridge_accept_assignment(uuid, uuid) to service_role;
grant execute on function public.foodbridge_update_delivery_status(uuid, uuid, text, text) to service_role;
grant execute on function public.foodbridge_create_donation(uuid, text, text, text, numeric, text, text, timestamp without time zone, text) to service_role;
grant execute on function public.foodbridge_cancel_donation(uuid, uuid) to service_role;
grant execute on function public.foodbridge_set_account_suspension(uuid, uuid, boolean) to service_role;
grant execute on function public.foodbridge_impact_totals(uuid) to service_role;

alter table public.profiles enable row level security;
alter table public.donor_profiles enable row level security;
alter table public.ngo_profiles enable row level security;
alter table public.partner_profiles enable row level security;
alter table public.donations enable row level security;
alter table public.ngo_matches enable row level security;
alter table public.donation_assignments enable row level security;
alter table public.status_events enable row level security;
alter table public.rescue_requests enable row level security;
alter table public.delivery_proofs enable row level security;
alter table public.notifications enable row level security;
alter table public.impact_records enable row level security;
alter table public.feedback enable row level security;

revoke all on table
  public.profiles,
  public.donor_profiles,
  public.ngo_profiles,
  public.partner_profiles,
  public.donations,
  public.ngo_matches,
  public.donation_assignments,
  public.status_events,
  public.rescue_requests,
  public.delivery_proofs,
  public.notifications,
  public.impact_records,
  public.feedback
from anon, authenticated;
revoke all on table
  public.profiles,
  public.donor_profiles,
  public.ngo_profiles,
  public.partner_profiles,
  public.donations,
  public.ngo_matches,
  public.donation_assignments,
  public.status_events,
  public.rescue_requests,
  public.delivery_proofs,
  public.notifications,
  public.impact_records,
  public.feedback
from public;
grant select on table
  public.profiles,
  public.donor_profiles,
  public.ngo_profiles,
  public.partner_profiles,
  public.donations,
  public.ngo_matches,
  public.donation_assignments,
  public.status_events,
  public.rescue_requests,
  public.delivery_proofs,
  public.notifications,
  public.impact_records,
  public.feedback
to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
grant update (organization_name, address, city) on public.donor_profiles to authenticated;
grant update (organization_name, address, city) on public.ngo_profiles to authenticated;
grant update (vehicle_type, vehicle_number, availability) on public.partner_profiles to authenticated;
grant insert (donor_id, food_name, description, food_category, quantity, quantity_unit, pickup_address, expiry_time, image_url)
  on public.donations to authenticated;
grant update (food_name, description, food_category, quantity, quantity_unit, pickup_address, expiry_time, image_url, status)
  on public.donations to authenticated;
grant update (is_read) on public.notifications to authenticated;
grant insert (donation_id, user_id, rating, comments) on public.feedback to authenticated;

do $policies$
declare
  item record;
  policy_kind text;
  policy_name text;
  policy_sql text;
begin
  for item in
    select * from (values
      ('profiles', 'SELECT', '(id = (select auth.uid()) and public.foodbridge_current_role() is not null) or public.foodbridge_is_admin()', null, null),
      ('profiles', 'UPDATE', 'id = (select auth.uid()) and public.foodbridge_current_role() is not null', 'id = (select auth.uid()) and public.foodbridge_current_role() is not null', null),
      ('donor_profiles', 'SELECT', '(user_id = (select auth.uid()) and public.foodbridge_current_role() = ''donor'') or public.foodbridge_is_admin()', null, null),
      ('donor_profiles', 'UPDATE', 'user_id = (select auth.uid()) and public.foodbridge_current_role() = ''donor''', 'user_id = (select auth.uid()) and public.foodbridge_current_role() = ''donor''', null),
      ('ngo_profiles', 'SELECT', '(user_id = (select auth.uid()) and public.foodbridge_current_role() = ''ngo'') or public.foodbridge_is_admin()', null, null),
      ('ngo_profiles', 'UPDATE', 'user_id = (select auth.uid()) and public.foodbridge_current_role() = ''ngo''', 'user_id = (select auth.uid()) and public.foodbridge_current_role() = ''ngo''', null),
      ('partner_profiles', 'SELECT', '(user_id = (select auth.uid()) and public.foodbridge_current_role() in (''delivery_partner_pending'', ''delivery_partner'')) or public.foodbridge_is_admin()', null, null),
      ('partner_profiles', 'UPDATE', 'user_id = (select auth.uid()) and public.foodbridge_current_role() = ''delivery_partner''', 'user_id = (select auth.uid()) and public.foodbridge_current_role() = ''delivery_partner''', null),
      ('donations', 'SELECT', 'public.foodbridge_can_view_donation(id)', null, null),
      ('donations', 'INSERT', null, null, 'public.foodbridge_owns_donor(donor_id)'),
      ('donations', 'UPDATE', 'public.foodbridge_owns_donor(donor_id) and status = ''available''', 'public.foodbridge_owns_donor(donor_id) and status in (''available'', ''cancelled'')', null),
      ('ngo_matches', 'SELECT', 'public.foodbridge_is_admin() or (public.foodbridge_is_verified_ngo() and exists (select 1 from public.ngo_profiles np where np.id = ngo_id and np.user_id = (select auth.uid())))', null, null),
      ('donation_assignments', 'SELECT', 'public.foodbridge_can_view_assignment(id)', null, null),
      ('status_events', 'SELECT', 'public.foodbridge_can_view_donation(donation_id)', null, null),
      ('rescue_requests', 'SELECT', 'public.foodbridge_is_admin() or public.foodbridge_can_view_donation(donation_id)', null, null),
      ('delivery_proofs', 'SELECT', 'public.foodbridge_can_view_assignment(assignment_id)', null, null),
      ('notifications', 'SELECT', '(user_id = (select auth.uid()) and public.foodbridge_current_role() is not null) or public.foodbridge_is_admin()', null, null),
      ('notifications', 'UPDATE', 'user_id = (select auth.uid()) and public.foodbridge_current_role() is not null', 'user_id = (select auth.uid()) and public.foodbridge_current_role() is not null', null),
      ('impact_records', 'SELECT', 'public.foodbridge_can_view_donation(donation_id)', null, null),
      ('feedback', 'SELECT', '(user_id = (select auth.uid()) and public.foodbridge_current_role() is not null) or public.foodbridge_can_view_donation(donation_id) or public.foodbridge_is_admin()', null, null),
      ('feedback', 'INSERT', null, null, 'user_id = (select auth.uid()) and public.foodbridge_current_role() is not null and public.foodbridge_can_view_donation(donation_id)')
    ) as rules(table_name, command_name, using_expression, check_expression, insert_check)
  loop
    foreach policy_kind in array array['allow', 'guard'] loop
      policy_name := 'foodbridge_' || policy_kind || '_' ||
        item.table_name || '_' || lower(item.command_name);
      if not exists (
        select 1 from pg_catalog.pg_policies
        where schemaname = 'public'
          and tablename = item.table_name
          and policyname = policy_name
      ) then
        if item.command_name = 'INSERT' then
          policy_sql := pg_catalog.format(
            'create policy %I on public.%I as %s for insert to authenticated with check (%s)',
            policy_name,
            item.table_name,
            case when policy_kind = 'allow' then 'PERMISSIVE' else 'RESTRICTIVE' end,
            item.insert_check
          );
        elsif item.command_name = 'UPDATE' then
          policy_sql := pg_catalog.format(
            'create policy %I on public.%I as %s for update to authenticated using (%s) with check (%s)',
            policy_name,
            item.table_name,
            case when policy_kind = 'allow' then 'PERMISSIVE' else 'RESTRICTIVE' end,
            item.using_expression,
            item.check_expression
          );
        else
          policy_sql := pg_catalog.format(
            'create policy %I on public.%I as %s for select to authenticated using (%s)',
            policy_name,
            item.table_name,
            case when policy_kind = 'allow' then 'PERMISSIVE' else 'RESTRICTIVE' end,
            item.using_expression
          );
        end if;
        execute policy_sql;
      end if;
    end loop;
  end loop;
end;
$policies$;

do $bucket_check$
begin
  if (
    select count(*) from storage.buckets
    where id in ('food-images', 'profile-images', 'delivery-proofs', 'ngo-documents')
  ) <> 4 then
    raise exception 'Expected all four existing FoodBridge storage buckets before applying this migration.';
  end if;
end;
$bucket_check$;

update storage.buckets
  set public = true,
      file_size_limit = 10485760,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
  where id in ('food-images', 'profile-images');
update storage.buckets
  set public = false,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
  where id = 'delivery-proofs';
update storage.buckets
  set public = false,
      file_size_limit = 10485760,
      allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png']
  where id = 'ngo-documents';

alter table storage.objects enable row level security;
revoke all on table storage.objects from public, anon, authenticated;
grant select on table storage.objects to anon, authenticated;
grant insert, update, delete on table storage.objects to authenticated;

do $storage_policies$
declare
  item record;
  policy_kind text;
  policy_name text;
  policy_sql text;
begin
  for item in
    select * from (values
      ('SELECT', 'bucket_id in (''food-images'', ''profile-images'')', 'bucket_id in (''food-images'', ''profile-images'')', 'anon'),
      ('SELECT', '(bucket_id in (''food-images'', ''profile-images'') or (bucket_id = ''delivery-proofs'' and public.foodbridge_can_view_proof_path((storage.foldername(name))[2])) or (bucket_id = ''ngo-documents'' and (public.foodbridge_is_admin() or ((storage.foldername(name))[1] = (select auth.uid())::text and public.foodbridge_current_role() = ''ngo''))))', '(bucket_id in (''food-images'', ''profile-images'') or (bucket_id = ''delivery-proofs'' and public.foodbridge_can_view_proof_path((storage.foldername(name))[2])) or (bucket_id = ''ngo-documents'' and (public.foodbridge_is_admin() or ((storage.foldername(name))[1] = (select auth.uid())::text and public.foodbridge_current_role() = ''ngo''))))', 'authenticated'),
      ('INSERT', null, null, 'authenticated'),
      ('UPDATE', null, null, 'authenticated'),
      ('DELETE', null, null, 'authenticated')
    ) as rules(command_name, using_expression, check_expression, role_list)
  loop
    if item.command_name = 'INSERT' then
      item.check_expression :=
        '((bucket_id = ''food-images'' and public.foodbridge_current_role() = ''donor'' and public.foodbridge_owns_donor((select dp.id from public.donor_profiles dp where dp.user_id = (select auth.uid()) limit 1)) and (storage.foldername(name))[1] = (select auth.uid())::text and (metadata->>''mimetype'') in (''image/jpeg'', ''image/png'', ''image/webp'')) or ' ||
        '(bucket_id = ''profile-images'' and public.foodbridge_current_role() is not null and (storage.foldername(name))[1] = (select auth.uid())::text and (metadata->>''mimetype'') in (''image/jpeg'', ''image/png'', ''image/webp'')) or ' ||
        '(bucket_id = ''delivery-proofs'' and public.foodbridge_can_access_proof_path((storage.foldername(name))[2]) and (storage.foldername(name))[1] = (select auth.uid())::text and (metadata->>''mimetype'') in (''image/jpeg'', ''image/png'', ''image/webp'')) or ' ||
        '(bucket_id = ''ngo-documents'' and public.foodbridge_current_role() = ''ngo'' and (storage.foldername(name))[1] = (select auth.uid())::text and (metadata->>''mimetype'') in (''application/pdf'', ''image/jpeg'', ''image/png''))';
    elsif item.command_name = 'UPDATE' or item.command_name = 'DELETE' then
      item.using_expression :=
        '((bucket_id = ''food-images'' and public.foodbridge_current_role() = ''donor'' and (storage.foldername(name))[1] = (select auth.uid())::text) or ' ||
        '(bucket_id = ''profile-images'' and public.foodbridge_current_role() is not null and (storage.foldername(name))[1] = (select auth.uid())::text) or ' ||
        '(bucket_id = ''delivery-proofs'' and public.foodbridge_can_access_proof_path((storage.foldername(name))[2])) or ' ||
        '(bucket_id = ''ngo-documents'' and (public.foodbridge_is_admin() or ((storage.foldername(name))[1] = (select auth.uid())::text and public.foodbridge_current_role() = ''ngo'')))';
      item.check_expression :=
        '((bucket_id = ''food-images'' and public.foodbridge_current_role() = ''donor'' and (storage.foldername(name))[1] = (select auth.uid())::text and (metadata->>''mimetype'') in (''image/jpeg'', ''image/png'', ''image/webp'')) or ' ||
        '(bucket_id = ''profile-images'' and public.foodbridge_current_role() is not null and (storage.foldername(name))[1] = (select auth.uid())::text and (metadata->>''mimetype'') in (''image/jpeg'', ''image/png'', ''image/webp'')) or ' ||
        '(bucket_id = ''delivery-proofs'' and public.foodbridge_can_access_proof_path((storage.foldername(name))[2]) and (metadata->>''mimetype'') in (''image/jpeg'', ''image/png'', ''image/webp'')) or ' ||
        '(bucket_id = ''ngo-documents'' and (public.foodbridge_is_admin() or ((storage.foldername(name))[1] = (select auth.uid())::text and public.foodbridge_current_role() = ''ngo'' and (metadata->>''mimetype'') in (''application/pdf'', ''image/jpeg'', ''image/png''))))';
    end if;

    foreach policy_kind in array array['allow', 'guard'] loop
      policy_name := 'foodbridge_' || policy_kind || '_storage_' ||
        lower(item.command_name) || '_' ||
        case when item.role_list = 'anon' then 'anon' else 'authenticated' end;
      if not exists (
        select 1 from pg_catalog.pg_policies
        where schemaname = 'storage'
          and tablename = 'objects'
          and policyname = policy_name
      ) then
        if item.command_name = 'SELECT' then
          policy_sql := pg_catalog.format(
            'create policy %I on storage.objects as %s for select to %s using (%s)',
            policy_name,
            case when policy_kind = 'allow' then 'PERMISSIVE' else 'RESTRICTIVE' end,
            item.role_list,
            item.using_expression
          );
        elsif item.command_name = 'INSERT' then
          policy_sql := pg_catalog.format(
            'create policy %I on storage.objects as %s for insert to authenticated with check (%s)',
            policy_name,
            case when policy_kind = 'allow' then 'PERMISSIVE' else 'RESTRICTIVE' end,
            item.check_expression
          );
        elsif item.command_name = 'UPDATE' then
          policy_sql := pg_catalog.format(
            'create policy %I on storage.objects as %s for update to authenticated using (%s) with check (%s)',
            policy_name,
            case when policy_kind = 'allow' then 'PERMISSIVE' else 'RESTRICTIVE' end,
            item.using_expression,
            item.check_expression
          );
        else
          policy_sql := pg_catalog.format(
            'create policy %I on storage.objects as %s for delete to authenticated using (%s)',
            policy_name,
            case when policy_kind = 'allow' then 'PERMISSIVE' else 'RESTRICTIVE' end,
            item.using_expression
          );
        end if;
        execute policy_sql;
      end if;
    end loop;
  end loop;
end;
$storage_policies$;

commit;
