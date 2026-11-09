begin;

create unique index if not exists ngo_profiles_user_id_unique
  on public.ngo_profiles (user_id)
  where user_id is not null;

commit;
