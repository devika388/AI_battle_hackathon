begin;

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
    select current_assignment.id,
      current_assignment.donation_id,
      current_assignment.partner_id,
      current_assignment.status::text;
end;
$$;

revoke all on function public.foodbridge_update_delivery_status(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.foodbridge_update_delivery_status(uuid, uuid, text, text)
  to service_role;

commit;
