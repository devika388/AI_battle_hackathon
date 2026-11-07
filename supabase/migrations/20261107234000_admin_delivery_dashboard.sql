begin;

alter table public.ngo_profiles
  add column if not exists verification_status text not null default 'pending',
  add column if not exists verification_notes text;

alter table public.partner_profiles
  add column if not exists verification_status text not null default 'pending',
  add column if not exists verification_notes text;

alter table public.delivery_proofs
  add column if not exists receiver_name text;

alter table public.donation_assignments
  add column if not exists delivery_stage text not null default 'pickup_pending';

update public.ngo_profiles
set verification_status = case when is_verified then 'approved' else verification_status end;

update public.partner_profiles pp
set verification_status = case
  when p.role = 'delivery_partner' then 'approved'
  else pp.verification_status
end
from public.profiles p
where p.id = pp.user_id;

update public.donation_assignments
set delivery_stage = case status
  when 'accepted' then 'pickup_pending'
  when 'assigned' then 'pickup_pending'
  when 'picked_up' then 'picked_up'
  when 'delivered' then 'awaiting_receipt'
  when 'completed' then 'completed'
  else delivery_stage
end;

create or replace function public.foodbridge_sync_delivery_stage()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    new.delivery_stage := case new.status
      when 'assigned' then 'pickup_pending'
      when 'picked_up' then 'picked_up'
      when 'delivered' then 'awaiting_receipt'
      when 'completed' then 'completed'
      else new.delivery_stage
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists foodbridge_sync_delivery_stage on public.donation_assignments;
create trigger foodbridge_sync_delivery_stage
before update of status on public.donation_assignments
for each row execute function public.foodbridge_sync_delivery_stage();

create or replace function public.foodbridge_notify_ngo_delivery()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  donation_name text;
  ngo_user_id uuid;
begin
  if new.status = 'delivered' and old.status is distinct from new.status then
    select d.food_name, np.user_id into donation_name, ngo_user_id
    from public.donations d
    join public.ngo_profiles np on np.id = new.ngo_id
    where d.id = new.donation_id;
    if ngo_user_id is not null then
      insert into public.notifications (user_id, title, message)
      values (
        ngo_user_id,
        'Delivery arrived',
        pg_catalog.format('The delivery partner marked "%s" delivered. Confirm receipt in your dashboard.', donation_name)
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists foodbridge_notify_ngo_delivery on public.donation_assignments;
create trigger foodbridge_notify_ngo_delivery
after update of status on public.donation_assignments
for each row execute function public.foodbridge_notify_ngo_delivery();

create or replace function public.foodbridge_update_delivery_stage(
  p_assignment_id uuid,
  p_partner_id uuid,
  p_stage text
)
returns table (assignment_id uuid, donation_id uuid, delivery_stage text, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_assignment public.donation_assignments%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Trusted backend access is required.' using errcode = '42501';
  end if;
  if p_stage not in ('pickup_started', 'picked_up', 'in_transit', 'arrived') then
    raise exception 'Unsupported delivery checkpoint.' using errcode = '22023';
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
    raise exception 'Delivery checkpoint transition is not allowed.' using errcode = '55000';
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
      values (current_assignment.donation_id, 'picked_up', 'Delivery partner confirmed pickup.');
  else
    update public.donation_assignments a
      set delivery_stage = p_stage
      where a.id = p_assignment_id
      returning * into current_assignment;
  end if;
  return query select current_assignment.id, current_assignment.donation_id,
    current_assignment.delivery_stage, current_assignment.status;
end;
$$;

revoke all on function public.foodbridge_update_delivery_stage(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.foodbridge_update_delivery_stage(uuid, uuid, text)
  to service_role;

commit;
