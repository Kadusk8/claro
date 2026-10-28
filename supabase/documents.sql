-- Run in the Supabase SQL Editor. This creates a private, PDF-only test bucket.
-- Existing buckets are not overwritten. Verify their privacy and policies.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contracts-quarantine', 'contracts-quarantine', false, 1048576, array['application/pdf'])
on conflict (id) do nothing;

select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'contracts-quarantine';

-- Review ALL existing policies: broad policies can also apply to this bucket.
-- No anon/authenticated policy is needed: only server service-role requests.
select policyname, roles, cmd, qual, with_check
from pg_policies where schemaname = 'storage' and tablename = 'objects';
