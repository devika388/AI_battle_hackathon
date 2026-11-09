begin;

create or replace function public.foodbridge_update_delivery_stage(
  p_assignment_id uuid,
  p_partner_id uuid,
  p_stage text
)
returns table (
  assignment_id uuid,
  donation_id uuid,
  delivery_stage text,
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
  if p_stage not in ('pickup_started', 'picked_up', 'in_transit', 'arrived') then
    raise exception 'Unsupported delivery checkpoint.'
      using errcode = '22023';
  end if;

  select a.* into current_assignment
  from public.donation_assignments a
  where a.id = p_assignment_id and a.partner_id = p_partner_id
  for update;
  if not found then
    raise exception 'Assignment not found.' using errcode = 'P0002';
  end if;

  if not (
    (current_assignment.delivery_stage = 'pickup_pending' and p_stage = 'pickup_started')
    or (current_assignment.delivery_stage = 'pickup_started' and p_stage = 'picked_up')
    or (current_assignment.delivery_stage = 'picked_up' and p_stage = 'in_transit')
    or (current_assignment.delivery_stage = 'in_transit' and p_stage = 'arrived')
  ) then
    raise exception 'Delivery checkpoint transition is not allowed.'
      using errcode = '55000';
  end if;

  if p_stage = 'picked_up' then
    update public.donation_assignments a
      set status = 'picked_up', delivery_stage = 'picked_up'
      where a.id = p_assignment_id
      returning * into current_assignment;
    update public.donations d
      set status = 'picked_up'
      where d.id = current_assignment.donation_id;
    insert into public.status_events (donation_id, status, description)
      values (
        current_assignment.donation_id,
        'picked_up',
        'Delivery partner confirmed pickup.'
      );
  else
    update public.donation_assignments a
      set delivery_stage = p_stage
      where a.id = p_assignment_id
      returning * into current_assignment;
  end if;

  return query
    select
      current_assignment.id,
      current_assignment.donation_id,
      current_assignment.delivery_stage::text,
      current_assignment.status::text;
end;
$$;

revoke all on function public.foodbridge_update_delivery_stage(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.foodbridge_update_delivery_stage(uuid, uuid, text)
  to service_role;

commit;
