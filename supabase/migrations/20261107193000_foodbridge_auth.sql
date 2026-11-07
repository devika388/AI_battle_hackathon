create or replace function public.complete_foodbridge_registration(
  p_user_id uuid,
  p_email text,
  p_registration jsonb
)
returns table (profile_id uuid, role text, is_approved boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_profile public.profiles%rowtype;
  requested_role text := p_registration ->> 'role';
  assigned_role text;
  approval_state boolean := false;
  has_existing_profile boolean := false;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Registration completion requires a trusted server.'
      using errcode = '42501';
  end if;

  if p_user_id is null
    or nullif(pg_catalog.btrim(p_email), '') is null
    or requested_role is null
    or requested_role not in ('donor', 'ngo', 'delivery_partner')
  then
    raise exception 'Invalid public registration.'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 0)
  );

  select profiles.*
    into existing_profile
    from public.profiles
    where profiles.id = p_user_id;
  has_existing_profile := found;

  assigned_role := case
    when requested_role = 'delivery_partner' then 'delivery_partner_pending'
    else requested_role
  end;

  if has_existing_profile then
    assigned_role := existing_profile.role;
    if existing_profile.role = case
      when requested_role = 'delivery_partner' then 'delivery_partner_pending'
      else requested_role
    end then
      if requested_role = 'donor' then
        if not exists (
          select 1 from public.donor_profiles
          where donor_profiles.user_id = p_user_id
        ) then
          insert into public.donor_profiles (
            user_id, organization_name, address, city
          ) values (
            p_user_id,
            p_registration ->> 'organization_name',
            p_registration ->> 'address',
            p_registration ->> 'city'
          );
        end if;
      elsif requested_role = 'ngo' then
        if not exists (
          select 1 from public.ngo_profiles
          where ngo_profiles.user_id = p_user_id
        ) then
          insert into public.ngo_profiles (
            user_id, organization_name, registration_number,
            address, city, is_verified
          ) values (
            p_user_id,
            p_registration ->> 'organization_name',
            p_registration ->> 'registration_number',
            p_registration ->> 'address',
            p_registration ->> 'city',
            false
          );
        end if;
      elsif requested_role = 'delivery_partner' then
        if not exists (
          select 1 from public.partner_profiles
          where partner_profiles.user_id = p_user_id
        ) then
          insert into public.partner_profiles (
            user_id, vehicle_type, vehicle_number, availability
          ) values (
            p_user_id,
            p_registration ->> 'vehicle_type',
            p_registration ->> 'vehicle_number',
            false
          );
        end if;
      end if;
    end if;
  else
    insert into public.profiles (id, full_name, email, role, phone)
    values (
      p_user_id,
      p_registration ->> 'full_name',
      p_email,
      assigned_role,
      p_registration ->> 'phone'
    );

    if requested_role = 'donor' then
      insert into public.donor_profiles (
        user_id, organization_name, address, city
      ) values (
        p_user_id,
        p_registration ->> 'organization_name',
        p_registration ->> 'address',
        p_registration ->> 'city'
      );
    elsif requested_role = 'ngo' then
      insert into public.ngo_profiles (
        user_id, organization_name, registration_number,
        address, city, is_verified
      ) values (
        p_user_id,
        p_registration ->> 'organization_name',
        p_registration ->> 'registration_number',
        p_registration ->> 'address',
        p_registration ->> 'city',
        false
      );
    elsif requested_role = 'delivery_partner' then
      insert into public.partner_profiles (
        user_id, vehicle_type, vehicle_number, availability
      ) values (
        p_user_id,
        p_registration ->> 'vehicle_type',
        p_registration ->> 'vehicle_number',
        false
      );
    end if;

    existing_profile.id := p_user_id;
    existing_profile.role := assigned_role;
  end if;

  if existing_profile.role = 'ngo' then
    select coalesce(ngo_profiles.is_verified, false)
      into approval_state
      from public.ngo_profiles
      where ngo_profiles.user_id = p_user_id;
    approval_state := coalesce(approval_state, false);
  elsif existing_profile.role = 'delivery_partner' then
    approval_state := true;
  end if;

  return query
    select existing_profile.id, existing_profile.role, approval_state;
end;
$$;

revoke all on function public.complete_foodbridge_registration(uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.complete_foodbridge_registration(uuid, text, jsonb)
  to service_role;

alter table public.profiles enable row level security;
alter table public.donor_profiles enable row level security;
alter table public.ngo_profiles enable row level security;
alter table public.partner_profiles enable row level security;

drop policy if exists foodbridge_profiles_read_self on public.profiles;
create policy foodbridge_profiles_read_self on public.profiles
  as restrictive for select to anon, authenticated
  using (id = (select auth.uid()));
drop policy if exists foodbridge_profiles_no_client_insert on public.profiles;
create policy foodbridge_profiles_no_client_insert on public.profiles
  as restrictive for insert to anon, authenticated
  with check (false);
drop policy if exists foodbridge_profiles_no_client_update on public.profiles;
create policy foodbridge_profiles_no_client_update on public.profiles
  as restrictive for update to anon, authenticated
  using (false) with check (false);
drop policy if exists foodbridge_profiles_no_client_delete on public.profiles;
create policy foodbridge_profiles_no_client_delete on public.profiles
  as restrictive for delete to anon, authenticated
  using (false);

drop policy if exists foodbridge_donor_profiles_read_self on public.donor_profiles;
create policy foodbridge_donor_profiles_read_self on public.donor_profiles
  as restrictive for select to anon, authenticated
  using (user_id = (select auth.uid()));
drop policy if exists foodbridge_donor_profiles_no_client_insert on public.donor_profiles;
create policy foodbridge_donor_profiles_no_client_insert on public.donor_profiles
  as restrictive for insert to anon, authenticated
  with check (false);
drop policy if exists foodbridge_donor_profiles_no_client_update on public.donor_profiles;
create policy foodbridge_donor_profiles_no_client_update on public.donor_profiles
  as restrictive for update to anon, authenticated
  using (false) with check (false);
drop policy if exists foodbridge_donor_profiles_no_client_delete on public.donor_profiles;
create policy foodbridge_donor_profiles_no_client_delete on public.donor_profiles
  as restrictive for delete to anon, authenticated
  using (false);

drop policy if exists foodbridge_ngo_profiles_read_self on public.ngo_profiles;
create policy foodbridge_ngo_profiles_read_self on public.ngo_profiles
  as restrictive for select to anon, authenticated
  using (user_id = (select auth.uid()));
drop policy if exists foodbridge_ngo_profiles_no_client_insert on public.ngo_profiles;
create policy foodbridge_ngo_profiles_no_client_insert on public.ngo_profiles
  as restrictive for insert to anon, authenticated
  with check (false);
drop policy if exists foodbridge_ngo_profiles_no_client_update on public.ngo_profiles;
create policy foodbridge_ngo_profiles_no_client_update on public.ngo_profiles
  as restrictive for update to anon, authenticated
  using (false) with check (false);
drop policy if exists foodbridge_ngo_profiles_no_client_delete on public.ngo_profiles;
create policy foodbridge_ngo_profiles_no_client_delete on public.ngo_profiles
  as restrictive for delete to anon, authenticated
  using (false);

drop policy if exists foodbridge_partner_profiles_read_self on public.partner_profiles;
create policy foodbridge_partner_profiles_read_self on public.partner_profiles
  as restrictive for select to anon, authenticated
  using (user_id = (select auth.uid()));
drop policy if exists foodbridge_partner_profiles_no_client_insert on public.partner_profiles;
create policy foodbridge_partner_profiles_no_client_insert on public.partner_profiles
  as restrictive for insert to anon, authenticated
  with check (false);
drop policy if exists foodbridge_partner_profiles_no_client_update on public.partner_profiles;
create policy foodbridge_partner_profiles_no_client_update on public.partner_profiles
  as restrictive for update to anon, authenticated
  using (false) with check (false);
drop policy if exists foodbridge_partner_profiles_no_client_delete on public.partner_profiles;
create policy foodbridge_partner_profiles_no_client_delete on public.partner_profiles
  as restrictive for delete to anon, authenticated
  using (false);
