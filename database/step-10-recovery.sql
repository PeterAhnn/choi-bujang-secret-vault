-- Private immutable snapshots and one-note recovery. Existing note grants/RLS stay unchanged.
begin;
lock table public.defense_notes in share row exclusive mode;

create table public.defense_note_backups (
  note_id uuid not null,
  owner_id uuid not null,
  source_id integer not null,
  title text not null,
  content text not null,
  source_created_at timestamptz not null,
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  backed_up_at timestamptz not null default now(),
  primary key (note_id, owner_id)
);
-- No foreign key to notes/auth.users: deletion must not delete snapshots and judge identities are separate.
create table public.defense_note_recovery_audit (
  id bigint generated always as identity primary key,
  note_id uuid not null,
  owner_id uuid not null,
  content_hash text not null,
  restored_at timestamptz not null default now()
);
alter table public.defense_note_backups enable row level security;
alter table public.defense_note_recovery_audit enable row level security;
revoke all on public.defense_note_backups, public.defense_note_recovery_audit
  from public, anon, authenticated, service_role;
grant select, insert on public.defense_note_backups, public.defense_note_recovery_audit to service_role;
revoke all on sequence public.defense_note_recovery_audit_id_seq from public, anon, authenticated, service_role;
grant usage, select on sequence public.defense_note_recovery_audit_id_seq to service_role;

create function public.defense_capture_note_backup()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.owner_id is null then raise exception 'backup_owner_required'; end if;
  insert into public.defense_note_backups
    (note_id, owner_id, source_id, title, content, source_created_at, content_hash)
  values (new.note_id, new.owner_id, new.id, new.title, new.content, new.created_at,
    encode(sha256(convert_to(jsonb_build_array(new.title, new.content)::text, 'UTF8')), 'hex'))
  on conflict (note_id, owner_id) do nothing;
  return new;
end;
$$;
revoke all on function public.defense_capture_note_backup() from public, anon, authenticated;
grant execute on function public.defense_capture_note_backup() to service_role;
create trigger defense_notes_capture_first_backup after insert on public.defense_notes
  for each row execute function public.defense_capture_note_backup();

-- The lock and trigger installation precede the initial snapshot in this transaction.
insert into public.defense_note_backups
  (note_id, owner_id, source_id, title, content, source_created_at, content_hash)
select note_id, owner_id, id, title, content, created_at,
  encode(sha256(convert_to(jsonb_build_array(title, content)::text, 'UTF8')), 'hex')
from public.defense_notes;

create function public.defense_restore_note(p_note_id uuid, p_owner_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  snapshot public.defense_note_backups%rowtype;
  restored_id uuid;
begin
  select * into snapshot from public.defense_note_backups
    where note_id = p_note_id and owner_id = p_owner_id;
  if not found then raise exception 'backup_not_found'; end if;
  if snapshot.content_hash <> encode(sha256(convert_to(
      jsonb_build_array(snapshot.title, snapshot.content)::text, 'UTF8')), 'hex') then
    raise exception 'backup_invalid';
  end if;
  insert into public.defense_notes as current_note
    (id, note_id, owner_id, title, content, created_at)
  values (snapshot.source_id, snapshot.note_id, snapshot.owner_id,
    snapshot.title, snapshot.content, snapshot.source_created_at)
  on conflict (note_id) do update set title = excluded.title, content = excluded.content
    where current_note.owner_id = excluded.owner_id and current_note.id = excluded.id
  returning note_id into restored_id;
  if not found or restored_id is distinct from p_note_id then raise exception 'restore_denied'; end if;
  if not exists (select 1 from public.defense_notes where note_id = p_note_id
      and owner_id = p_owner_id and id = snapshot.source_id
      and encode(sha256(convert_to(jsonb_build_array(title, content)::text, 'UTF8')), 'hex') = snapshot.content_hash) then
    raise exception 'restore_verification_failed';
  end if;
  insert into public.defense_note_recovery_audit(note_id, owner_id, content_hash)
    values (p_note_id, p_owner_id, snapshot.content_hash);
  return jsonb_build_object('id', p_note_id, 'restored', true, 'contentHash', snapshot.content_hash);
end;
$$;
revoke all on function public.defense_restore_note(uuid, uuid) from public, anon, authenticated;
grant execute on function public.defense_restore_note(uuid, uuid) to service_role;
commit;
