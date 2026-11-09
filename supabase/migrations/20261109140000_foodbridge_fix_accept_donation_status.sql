begin;

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
      created_assignment.ngo_id, created_assignment.status::text,
      created_assignment.assigned_at;
end;
$$;

revoke all on function public.foodbridge_accept_donation(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.foodbridge_accept_donation(uuid, uuid)
  to service_role;

commit;
