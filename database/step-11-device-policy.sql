-- Review only until approved. Scope: new device, nonce and device-audit objects.
-- Existing notes, note backups, note recovery audit, grants and RLS are unchanged.
begin;

create table public.defense_devices (
  device_id text primary key check (device_id ~ '^[a-f0-9]{16}$'),
  fingerprint text not null unique check (fingerprint ~ '^[a-f0-9]{64}$'),
  public_jwk jsonb not null,
  requested_by uuid not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'denied', 'revoked')),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint defense_devices_fingerprint_id check (device_id = left(fingerprint, 16)),
  constraint defense_devices_approval_time check (status <> 'approved' or approved_at is not null),
  constraint defense_devices_public_key_types check (coalesce(
    jsonb_typeof(public_jwk -> 'kty') = 'string'
    and jsonb_typeof(public_jwk -> 'crv') = 'string', false)),
  constraint defense_devices_public_p256 check (
    jsonb_typeof(public_jwk) = 'object'
    and public_jwk ?& array['kty', 'crv', 'x', 'y']
    and public_jwk ->> 'kty' = 'EC'
    and public_jwk ->> 'crv' = 'P-256'
    and jsonb_typeof(public_jwk -> 'x') = 'string'
    and jsonb_typeof(public_jwk -> 'y') = 'string'
    and public_jwk ->> 'x' ~ '^[A-Za-z0-9_-]{43}$'
    and public_jwk ->> 'y' ~ '^[A-Za-z0-9_-]{43}$'
    and not (public_jwk ? 'd')
    and public_jwk - array['kty', 'crv', 'x', 'y', 'ext', 'key_ops'] = '{}'::jsonb
    and (not (public_jwk ? 'ext') or jsonb_typeof(public_jwk -> 'ext') = 'boolean')
    and (not (public_jwk ? 'key_ops') or public_jwk -> 'key_ops' = '["verify"]'::jsonb)
  )
);
-- No auth.users foreign key: separately verified synthetic judge identities are valid callers.
-- requested_by records the requester; approval is global to this public device key.
alter table public.defense_devices enable row level security;
revoke all on table public.defense_devices from public, anon, authenticated, service_role;
grant select on table public.defense_devices to service_role;
grant insert (device_id, fingerprint, public_jwk, requested_by)
  on table public.defense_devices to service_role;

create table public.defense_device_nonces (
  device_id text not null references public.defense_devices(device_id) on delete restrict,
  nonce text not null check (nonce ~ '^[A-Za-z0-9_-]{32}$'),
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (device_id, nonce)
);
alter table public.defense_device_nonces enable row level security;
revoke all on table public.defense_device_nonces from public, anon, authenticated, service_role;
grant select, insert on table public.defense_device_nonces to service_role;

create table public.defense_device_audit (
  id bigint generated always as identity primary key,
  device_id text not null references public.defense_devices(device_id) on delete restrict,
  event text not null check (event in ('requested', 'status_changed')),
  previous_status text check (previous_status in ('pending', 'approved', 'denied', 'revoked')),
  status text not null check (status in ('pending', 'approved', 'denied', 'revoked')),
  requested_by uuid not null,
  actor_role text not null default current_user,
  created_at timestamptz not null default now()
);
alter table public.defense_device_audit enable row level security;
revoke all on table public.defense_device_audit from public, anon, authenticated, service_role;
grant select on table public.defense_device_audit to service_role;
grant insert (device_id, event, previous_status, status, requested_by)
  on table public.defense_device_audit to service_role;
revoke all on sequence public.defense_device_audit_id_seq from public, anon, authenticated, service_role;
grant usage, select on sequence public.defense_device_audit_id_seq to service_role;

create function public.defense_capture_device_audit()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.defense_device_audit(device_id, event, previous_status, status, requested_by)
      values (new.device_id, 'requested', null, new.status, new.requested_by);
  elsif old.status is distinct from new.status then
    insert into public.defense_device_audit(device_id, event, previous_status, status, requested_by)
      values (new.device_id, 'status_changed', old.status, new.status, new.requested_by);
  end if;
  return new;
end;
$$;
revoke all on function public.defense_capture_device_audit() from public, anon, authenticated;
grant execute on function public.defense_capture_device_audit() to service_role;
create trigger defense_devices_capture_audit after insert or update of status on public.defense_devices
  for each row execute function public.defense_capture_device_audit();

-- The server must verify the user JWT, P-256 signature and timestamp before this RPC.
-- The caller supplies the verified user; requested_by is not an authorization grant.
create function public.defense_claim_device_nonce(p_device_id text, p_nonce text, p_user_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  claimed_rows integer;
begin
  if p_device_id is null or p_device_id !~ '^[a-f0-9]{16}$'
      or p_nonce is null or p_nonce !~ '^[A-Za-z0-9_-]{32}$' or p_user_id is null then
    return false;
  end if;
  -- Approval selection and the nonce claim share one SQL statement snapshot.
  insert into public.defense_device_nonces(device_id, nonce, user_id)
    select device_id, p_nonce, p_user_id from public.defense_devices
      where device_id = p_device_id and status = 'approved' and approved_at is not null
    on conflict (device_id, nonce) do nothing;
  get diagnostics claimed_rows = row_count;
  return claimed_rows = 1;
end;
$$;
revoke all on function public.defense_claim_device_nonce(text, text, uuid) from public, anon, authenticated;
grant execute on function public.defense_claim_device_nonce(text, text, uuid) to service_role;
commit;
