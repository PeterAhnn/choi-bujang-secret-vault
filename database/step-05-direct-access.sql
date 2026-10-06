-- Step 5 maker 2: review-only until the student's execution instruction.
-- Only public.defense_notes table privileges change. Preserve data, RLS and server grants.
-- BEFORE
select grantee,privilege_type from information_schema.role_table_grants
where table_schema='public' and table_name='defense_notes'
  and grantee in ('PUBLIC','anon','authenticated') order by grantee,privilege_type;
select r as role,p as privilege,has_table_privilege(r,'public.defense_notes',p) as allowed
from unnest(array['anon','authenticated']) r
cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p
order by r,p;

begin;
revoke all on table public.defense_notes from PUBLIC, anon, authenticated;
do $$
begin
  if exists (select 1 from unnest(array['anon','authenticated']) r
    cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p
    where has_table_privilege(r,'public.defense_notes',p)) then
    raise exception 'Unexpected inherited defense_notes privileges: review before proceeding';
  end if;
  if exists (select 1 from information_schema.role_table_grants
    where table_schema='public' and table_name='defense_notes'
      and grantee in ('PUBLIC','anon','authenticated')) then
    raise exception 'Unexpected remaining explicit defense_notes grants';
  end if;
  if exists (select 1 from unnest(array['SELECT','INSERT','UPDATE','DELETE']) p
    where not has_table_privilege('service_role','public.defense_notes',p)) then
    raise exception 'Preserve server defense_notes CRUD privileges';
  end if;
end $$;
commit;

-- AFTER: no direct privileges; server function grants are unchanged.
select grantee,privilege_type from information_schema.role_table_grants
where table_schema='public' and table_name='defense_notes'
  and grantee in ('PUBLIC','anon','authenticated') order by grantee,privilege_type;
select r as role,p as privilege,has_table_privilege(r,'public.defense_notes',p) as allowed
from unnest(array['anon','authenticated']) r
cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p
order by r,p;
