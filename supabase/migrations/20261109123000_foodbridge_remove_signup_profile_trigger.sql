begin;

drop trigger if exists foodbridge_auth_user_registration on auth.users;
drop function if exists public.handle_foodbridge_auth_user_registration();
drop function if exists public.ensure_foodbridge_registration_profile(uuid, text, jsonb);

commit;
