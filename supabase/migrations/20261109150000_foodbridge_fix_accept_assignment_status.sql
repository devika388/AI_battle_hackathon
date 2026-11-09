begin;

create or replace function public.foodbridge_accept_assignment(
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
      current_assignment.partner_id, current_assignment.status::text,
      current_assignment.assigned_at;
end;
$$;

revoke all on function public.foodbridge_accept_assignment(uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.foodbridge_accept_assignment(uuid, uuid, integer)
  to service_role;

commit;
