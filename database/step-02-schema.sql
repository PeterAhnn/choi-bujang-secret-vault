-- Step 2: server-only educational notes. Seed bodies stay outside public Git.
begin;

create table if not exists public.defense_notes (
  id integer primary key,
  owner_id uuid,
  title text not null check (char_length(title) between 1 and 100),
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);

alter table public.defense_notes enable row level security;
revoke all on table public.defense_notes from public, anon, authenticated;
grant select on table public.defense_notes to service_role;

-- No client policies and no auth.users foreign key at this stage.
commit;
