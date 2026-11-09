begin;

grant insert (id, full_name, email, phone, role)
  on public.profiles to authenticated;
grant insert (user_id, organization_name, address, city)
  on public.donor_profiles to authenticated;
grant insert (
  user_id, organization_name, registration_number, address, city,
  is_verified, verification_status
)
  on public.ngo_profiles to authenticated;
grant insert (
  user_id, vehicle_type, vehicle_number, availability, verification_status
)
  on public.partner_profiles to authenticated;

drop policy if exists foodbridge_profiles_no_client_insert on public.profiles;
drop policy if exists foodbridge_profiles_registration_insert on public.profiles;
drop policy if exists foodbridge_profiles_registration_insert_grant on public.profiles;
create policy foodbridge_profiles_registration_insert on public.profiles
  as restrictive for insert to authenticated
  with check (
    id = (select auth.uid())
    and role in ('donor', 'ngo', 'delivery_partner')
    and role = (
      (select auth.jwt()) -> 'user_metadata' -> 'registration' ->> 'role'
    )
    and lower(email) = lower((select auth.jwt()) ->> 'email')
    and full_name = (
      (select auth.jwt()) -> 'user_metadata' -> 'registration' ->> 'full_name'
    )
    and phone = (
      (select auth.jwt()) -> 'user_metadata' -> 'registration' ->> 'phone'
    )
  );
create policy foodbridge_profiles_registration_insert_grant on public.profiles
  for insert to authenticated
  with check (
    id = (select auth.uid())
    and role in ('donor', 'ngo', 'delivery_partner')
    and role = (
      (select auth.jwt()) -> 'user_metadata' -> 'registration' ->> 'role'
    )
    and lower(email) = lower((select auth.jwt()) ->> 'email')
    and full_name = (
      (select auth.jwt()) -> 'user_metadata' -> 'registration' ->> 'full_name'
    )
    and phone = (
      (select auth.jwt()) -> 'user_metadata' -> 'registration' ->> 'phone'
    )
  );

drop policy if exists foodbridge_donor_profiles_no_client_insert
  on public.donor_profiles;
drop policy if exists foodbridge_donor_profiles_registration_insert
  on public.donor_profiles;
drop policy if exists foodbridge_donor_profiles_registration_insert_grant
  on public.donor_profiles;
create policy foodbridge_donor_profiles_registration_insert
  on public.donor_profiles
  as restrictive for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'donor'
    )
    and (select auth.jwt()) -> 'user_metadata' -> 'registration' ->> 'role'
      = 'donor'
  );
create policy foodbridge_donor_profiles_registration_insert_grant
  on public.donor_profiles
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'donor'
    )
    and (select auth.jwt()) -> 'user_metadata' -> 'registration' ->> 'role'
      = 'donor'
  );

drop policy if exists foodbridge_ngo_profiles_no_client_insert
  on public.ngo_profiles;
drop policy if exists foodbridge_ngo_profiles_registration_insert
  on public.ngo_profiles;
drop policy if exists foodbridge_ngo_profiles_registration_insert_grant
  on public.ngo_profiles;
create policy foodbridge_ngo_profiles_registration_insert
  on public.ngo_profiles
  as restrictive for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and is_verified = true
    and verification_status = 'approved'
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'ngo'
    )
    and (select auth.jwt()) -> 'user_metadata' -> 'registration' ->> 'role'
      = 'ngo'
  );
create policy foodbridge_ngo_profiles_registration_insert_grant
  on public.ngo_profiles
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and is_verified = true
    and verification_status = 'approved'
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'ngo'
    )
    and (select auth.jwt()) -> 'user_metadata' -> 'registration' ->> 'role'
      = 'ngo'
  );

drop policy if exists foodbridge_partner_profiles_no_client_insert
  on public.partner_profiles;
drop policy if exists foodbridge_partner_profiles_registration_insert
  on public.partner_profiles;
drop policy if exists foodbridge_partner_profiles_registration_insert_grant
  on public.partner_profiles;
create policy foodbridge_partner_profiles_registration_insert
  on public.partner_profiles
  as restrictive for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('delivery_partner', 'delivery_partner_pending')
        and verification_status = case p.role
          when 'delivery_partner' then 'approved'
          else 'pending'
        end
    )
    and (select auth.jwt()) -> 'user_metadata' -> 'registration' ->> 'role'
      = 'delivery_partner'
  );
create policy foodbridge_partner_profiles_registration_insert_grant
  on public.partner_profiles
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('delivery_partner', 'delivery_partner_pending')
        and verification_status = case p.role
          when 'delivery_partner' then 'approved'
          else 'pending'
        end
    )
    and (select auth.jwt()) -> 'user_metadata' -> 'registration' ->> 'role'
      = 'delivery_partner'
  );

commit;
