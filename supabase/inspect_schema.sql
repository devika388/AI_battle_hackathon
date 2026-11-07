-- Read-only inspection of the existing FoodBridge tables and storage policies.
-- Run in the Supabase SQL Editor and share the resulting JSON before adding
-- application policies or transactions that depend on the live schema.
with target_tables as (
  select
    c.oid,
    n.nspname as schema_name,
    c.relname as table_name,
    c.relrowsecurity as rls_enabled,
    c.relforcerowsecurity as rls_forced
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and c.relname = any (array[
      'profiles',
      'donor_profiles',
      'ngo_profiles',
      'partner_profiles',
      'donations',
      'ngo_matches',
      'donation_assignments',
      'status_events',
      'rescue_requests',
      'delivery_proofs',
      'notifications',
      'impact_records',
      'feedback'
    ])
)
select pg_catalog.jsonb_pretty(
  pg_catalog.jsonb_build_object(
    'tables',
    coalesce(
      (
        select pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'table', t.table_name,
            'rls_enabled', t.rls_enabled,
            'rls_forced', t.rls_forced,
            'columns', coalesce(
              (
                select pg_catalog.jsonb_agg(
                  pg_catalog.jsonb_build_object(
                    'name', c.column_name,
                    'type', c.data_type,
                    'udt', c.udt_name,
                    'nullable', c.is_nullable = 'YES',
                    'default', c.column_default
                  )
                  order by c.ordinal_position
                )
                from information_schema.columns c
                where c.table_schema = t.schema_name
                  and c.table_name = t.table_name
              ),
              '[]'::jsonb
            ),
            'constraints', coalesce(
              (
                select pg_catalog.jsonb_agg(
                  pg_catalog.jsonb_build_object(
                    'name', con.conname,
                    'type', con.contype,
                    'definition', pg_catalog.pg_get_constraintdef(con.oid)
                  )
                  order by con.conname
                )
                from pg_catalog.pg_constraint con
                where con.conrelid = t.oid
              ),
              '[]'::jsonb
            ),
            'indexes', coalesce(
              (
                select pg_catalog.jsonb_agg(
                  pg_catalog.jsonb_build_object(
                    'name', i.indexname,
                    'definition', i.indexdef
                  )
                  order by i.indexname
                )
                from pg_catalog.pg_indexes i
                where i.schemaname = t.schema_name
                  and i.tablename = t.table_name
              ),
              '[]'::jsonb
            ),
            'policies', coalesce(
              (
                select pg_catalog.jsonb_agg(
                  pg_catalog.jsonb_build_object(
                    'name', p.policyname,
                    'command', p.cmd,
                    'permissive', p.permissive,
                    'roles', p.roles,
                    'using', p.qual,
                    'with_check', p.with_check
                  )
                  order by p.policyname
                )
                from pg_catalog.pg_policies p
                where p.schemaname = t.schema_name
                  and p.tablename = t.table_name
              ),
              '[]'::jsonb
            ),
            'triggers', coalesce(
              (
                select pg_catalog.jsonb_agg(
                  pg_catalog.jsonb_build_object(
                    'name', tr.tgname,
                    'definition', pg_catalog.pg_get_triggerdef(tr.oid)
                  )
                  order by tr.tgname
                )
                from pg_catalog.pg_trigger tr
                where tr.tgrelid = t.oid
                  and not tr.tgisinternal
              ),
              '[]'::jsonb
            )
          )
          order by t.table_name
        )
        from target_tables t
      ),
      '[]'::jsonb
    ),
    'storage_buckets',
    coalesce(
      (
        select pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'id', b.id,
            'name', b.name,
            'public', b.public,
            'file_size_limit', b.file_size_limit,
            'allowed_mime_types', b.allowed_mime_types
          )
          order by b.id
        )
        from storage.buckets b
        where b.id = any (array[
          'food-images',
          'profile-images',
          'delivery-proofs',
          'ngo-documents'
        ])
      ),
      '[]'::jsonb
    ),
    'storage_object_policies',
    coalesce(
      (
        select pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'name', p.policyname,
            'command', p.cmd,
            'permissive', p.permissive,
            'roles', p.roles,
            'using', p.qual,
            'with_check', p.with_check
          )
          order by p.policyname
        )
        from pg_catalog.pg_policies p
        where p.schemaname = 'storage'
          and p.tablename = 'objects'
      ),
      '[]'::jsonb
    )
  )
) as foodbridge_schema_inspection;
