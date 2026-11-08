begin;

update public.ngo_profiles
set is_verified = true,
    verification_status = 'approved',
    verification_notes = null
where is_verified = false
  and verification_status = 'pending';

update public.profiles p
set role = 'delivery_partner'
from public.partner_profiles pp
where pp.user_id = p.id
  and p.role = 'delivery_partner_pending'
  and pp.verification_status = 'pending';

update public.partner_profiles pp
set verification_status = 'approved',
    verification_notes = null
from public.profiles p
where p.id = pp.user_id
  and p.role = 'delivery_partner'
  and pp.verification_status = 'pending';

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

  if has_existing_profile then
    if requested_role = 'delivery_partner'
      and existing_profile.role = 'delivery_partner_pending'
    then
      update public.profiles
        set role = 'delivery_partner'
        where id = p_user_id;
      existing_profile.role := 'delivery_partner';
    end if;

    if existing_profile.role = requested_role then
      if requested_role = 'donor' then
        insert into public.donor_profiles (
          user_id, organization_name, address, city
        )
        select
          p_user_id,
          p_registration ->> 'organization_name',
          p_registration ->> 'address',
          p_registration ->> 'city'
        where not exists (
          select 1 from public.donor_profiles
          where donor_profiles.user_id = p_user_id
        );
      elsif requested_role = 'ngo' then
        insert into public.ngo_profiles (
          user_id, organization_name, registration_number,
          address, city, is_verified, verification_status
        )
        select
          p_user_id,
          p_registration ->> 'organization_name',
          p_registration ->> 'registration_number',
          p_registration ->> 'address',
          p_registration ->> 'city',
          true,
          'approved'
        where not exists (
          select 1 from public.ngo_profiles
          where ngo_profiles.user_id = p_user_id
        );
        update public.ngo_profiles
          set is_verified = true,
              verification_status = 'approved',
              verification_notes = null
          where user_id = p_user_id
            and verification_status = 'pending';
      elsif requested_role = 'delivery_partner' then
        insert into public.partner_profiles (
          user_id, vehicle_type, vehicle_number, availability,
          verification_status
        )
        select
          p_user_id,
          p_registration ->> 'vehicle_type',
          p_registration ->> 'vehicle_number',
          false,
          'approved'
        where not exists (
          select 1 from public.partner_profiles
          where partner_profiles.user_id = p_user_id
        );
        update public.partner_profiles
          set verification_status = 'approved',
              verification_notes = null
          where user_id = p_user_id
            and verification_status = 'pending';
      end if;
    end if;
  else
    insert into public.profiles (id, full_name, email, role, phone)
    values (
      p_user_id,
      p_registration ->> 'full_name',
      p_email,
      requested_role,
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
        address, city, is_verified, verification_status
      ) values (
        p_user_id,
        p_registration ->> 'organization_name',
        p_registration ->> 'registration_number',
        p_registration ->> 'address',
        p_registration ->> 'city',
        true,
        'approved'
      );
    elsif requested_role = 'delivery_partner' then
      insert into public.partner_profiles (
        user_id, vehicle_type, vehicle_number, availability,
        verification_status
      ) values (
        p_user_id,
        p_registration ->> 'vehicle_type',
        p_registration ->> 'vehicle_number',
        false,
        'approved'
      );
    end if;

    existing_profile.id := p_user_id;
    existing_profile.role := requested_role;
  end if;

  return query
    select
      existing_profile.id,
      existing_profile.role,
      existing_profile.role in ('donor', 'ngo', 'delivery_partner');
end;
$$;

revoke all on function public.complete_foodbridge_registration(uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.complete_foodbridge_registration(uuid, text, jsonb)
  to service_role;

commit;
