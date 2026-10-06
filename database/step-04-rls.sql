-- Step 4 maker 3: review before execution in the dedicated defense DB.
-- Scope: public.defense_notes only. No note values or account identifiers.
-- Existing server service_role grants are preserved.

-- BEFORE: explicit grants and effective privileges (including inherited grants).
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema='public' and table_name='defense_notes'
  and grantee in ('PUBLIC','anon','authenticated')
order by grantee, privilege_type;
select r as role, p as privilege,
  has_table_privilege(r,'public.defense_notes',p) as allowed
from unnest(array['anon','authenticated']) r
cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p
order by r,p;

begin;
-- Unexpected policies require review; do not silently replace other work.
do $$
begin
  if exists (select 1 from pg_policies
    where schemaname='public' and tablename='defense_notes'
    and policyname not in ('defense_notes_select_owner','defense_notes_insert_owner',
      'defense_notes_update_owner','defense_notes_delete_owner')) then
    raise exception 'Review unexpected defense_notes policies before applying';
  end if;
end $$;

revoke all on table public.defense_notes from PUBLIC, anon, authenticated;
alter table public.defense_notes enable row level security;

drop policy if exists defense_notes_select_owner on public.defense_notes;
drop policy if exists defense_notes_insert_owner on public.defense_notes;
drop policy if exists defense_notes_update_owner on public.defense_notes;
drop policy if exists defense_notes_delete_owner on public.defense_notes;

create policy defense_notes_select_owner on public.defense_notes
  for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy defense_notes_insert_owner on public.defense_notes
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy defense_notes_update_owner on public.defense_notes
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy defense_notes_delete_owner on public.defense_notes
  for delete to authenticated
  using ((select auth.uid()) = owner_id);

grant select, insert, update, delete on table public.defense_notes to authenticated;

-- Abort the whole transaction if effective permissions differ from the contract.
do $$
begin
  if exists (select 1
    from unnest(array['anon','authenticated']) r
    cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p
    where has_table_privilege(r,'public.defense_notes',p)
      <> (r='authenticated' and p in ('SELECT','INSERT','UPDATE','DELETE'))) then
    raise exception 'Unexpected effective defense_notes privileges';
  end if;
  if exists (select 1 from information_schema.role_table_grants
    where table_schema='public' and table_name='defense_notes'
      and (grantee in ('PUBLIC','anon') or
        (grantee='authenticated' and privilege_type not in ('SELECT','INSERT','UPDATE','DELETE')))) then
    raise exception 'Unexpected explicit defense_notes grants';
  end if;
end $$;
commit;

-- AFTER: compare with BEFORE. anon: none; authenticated: CRUD only.
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema='public' and table_name='defense_notes'
  and grantee in ('PUBLIC','anon','authenticated')
order by grantee, privilege_type;
select r as role, p as privilege,
  has_table_privilege(r,'public.defense_notes',p) as allowed
from unnest(array['anon','authenticated']) r
cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p
order by r,p;
select policyname,cmd,roles,qual,with_check
from pg_policies where schemaname='public' and tablename='defense_notes'
order by policyname;
