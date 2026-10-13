-- Review only. Run the complete file with first-error stopping enabled.
-- A public P-256 fixture is used; there is no private key or real user identifier.
-- No notes, note snapshots or existing audit rows are modified.
begin;

do $$
declare
  context_json jsonb;
begin
  if (select count(*) from public.defense_notes) <> 4 then raise exception 'expected_four_virtual_notes'; end if;
  select jsonb_build_object(
    'device_id', '77ec6ff4a7a72641',
    'fingerprint', '77ec6ff4a7a726410b4a3be87397d1deaf41fdf80f3ea8d39fddaf8b45107ca2',
    'public_jwk', '{"kty":"EC","crv":"P-256","x":"axfR8uEsQkf4vOblY6RA8ncDfYEt6zOg9KE5RdiYwpY","y":"T-NC4v4af5uO5-tKfA-eFivOM1drMV7Oy7ZAaDe_UfU"}'::jsonb,
    'user_id', gen_random_uuid(),
    'notes_hash', (select encode(sha256(convert_to(jsonb_agg(to_jsonb(n) order by id)::text, 'UTF8')), 'hex')
      from public.defense_notes n),
    'audit_hash', (select encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(a) order by id)::text, '[]'), 'UTF8')), 'hex')
      from public.defense_device_audit a)) into context_json;
  perform set_config('defense.device_check_context', context_json::text, true);
  if exists (select 1 from public.defense_devices
      where device_id = context_json ->> 'device_id' or fingerprint = context_json ->> 'fingerprint') then
    raise exception 'synthetic_device_already_exists';
  end if;
end;
$$;

set local role service_role;
do $$
declare
  context record;
  context_json jsonb := current_setting('defense.device_check_context')::jsonb;
  invalid_field text;
begin
  select context_json ->> 'device_id' as device_id, context_json ->> 'fingerprint' as fingerprint,
    context_json -> 'public_jwk' as public_jwk, (context_json ->> 'user_id')::uuid as user_id
    into strict context;
  insert into public.defense_devices(device_id, fingerprint, public_jwk, requested_by)
    values (context.device_id, context.fingerprint, context.public_jwk, context.user_id);
  if not exists (select 1 from public.defense_devices where device_id = context.device_id
      and status = 'pending' and approved_at is null and requested_by = context.user_id) then
    raise exception 'pending_request_failed';
  end if;
  foreach invalid_field in array array['kty', 'crv'] loop
    begin
      insert into public.defense_devices(device_id, fingerprint, public_jwk, requested_by)
        values (repeat('8', 16), repeat('8', 64),
          jsonb_set(context.public_jwk, array[invalid_field], 'null'::jsonb), context.user_id);
      raise exception 'null_key_type_unexpected';
    exception when check_violation then null;
    end;
  end loop;
  begin
    insert into public.defense_devices(device_id, fingerprint, public_jwk, requested_by, status, approved_at)
      values (context.device_id, context.fingerprint, context.public_jwk, context.user_id, 'approved', now());
    raise exception 'status_insert_unexpected';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.defense_devices set status = 'approved', approved_at = now() where device_id = context.device_id;
    raise exception 'self_approval_unexpected';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.defense_devices where device_id = context.device_id;
    raise exception 'device_delete_unexpected';
  exception when insufficient_privilege then null;
  end;
  if public.defense_claim_device_nonce(context.device_id, repeat('A', 32), context.user_id) is distinct from false
      or public.defense_claim_device_nonce('invalid-device', repeat('A', 32), context.user_id) is distinct from false
      or public.defense_claim_device_nonce(context.device_id, 'short', context.user_id) is distinct from false
      or public.defense_claim_device_nonce(context.device_id, repeat('A', 32), null) is distinct from false then
    raise exception 'unapproved_or_invalid_nonce_accepted';
  end if;
  if exists (select 1 from public.defense_device_nonces where device_id = context.device_id) then
    raise exception 'unapproved_nonce_persisted';
  end if;
  if (select count(*) from public.defense_device_audit where device_id = context.device_id
      and event = 'requested' and status = 'pending' and actor_role = 'service_role'
      and requested_by = context.user_id) <> 1 then raise exception 'request_audit_missing'; end if;
end;
$$;

reset role;
set local role anon;
do $$
begin
  begin
    perform 1 from public.defense_devices;
    raise exception 'anon_device_read_unexpected';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.defense_device_nonces;
    raise exception 'anon_nonce_read_unexpected';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.defense_device_audit;
    raise exception 'anon_audit_read_unexpected';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.defense_claim_device_nonce('77ec6ff4a7a72641', repeat('A', 32), gen_random_uuid());
    raise exception 'anon_nonce_rpc_unexpected';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
set local role authenticated;
do $$
begin
  begin
    perform 1 from public.defense_devices;
    raise exception 'authenticated_device_read_unexpected';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.defense_device_nonces;
    raise exception 'authenticated_nonce_read_unexpected';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.defense_device_audit;
    raise exception 'authenticated_audit_read_unexpected';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.defense_claim_device_nonce('77ec6ff4a7a72641', repeat('A', 32), gen_random_uuid());
    raise exception 'authenticated_nonce_rpc_unexpected';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
-- The admin transition is restricted to this transaction's synthetic public key.
do $$
declare
  context record;
  context_json jsonb := current_setting('defense.device_check_context')::jsonb;
begin
  select context_json ->> 'device_id' as device_id, context_json ->> 'fingerprint' as fingerprint
    into strict context;
  update public.defense_devices set status = 'approved', approved_at = now()
    where device_id = context.device_id and fingerprint = context.fingerprint and status = 'pending';
  if not found then raise exception 'admin_fixture_approval_failed'; end if;
end;
$$;

set local role service_role;
do $$
declare
  context record;
  context_json jsonb := current_setting('defense.device_check_context')::jsonb;
begin
  select context_json ->> 'device_id' as device_id, (context_json ->> 'user_id')::uuid as user_id
    into strict context;
  if public.defense_claim_device_nonce(context.device_id, repeat('A', 32), context.user_id) is distinct from true then
    raise exception 'approved_nonce_claim_failed';
  end if;
  if public.defense_claim_device_nonce(context.device_id, repeat('A', 32), context.user_id) is distinct from false then
    raise exception 'nonce_replay_accepted';
  end if;
  if (select count(*) from public.defense_device_nonces where device_id = context.device_id
      and user_id = context.user_id and nonce = repeat('A', 32)) <> 1 then
    raise exception 'unexpected_claim_count';
  end if;
  if (select count(*) from public.defense_device_audit where device_id = context.device_id) <> 2
      or not exists (select 1 from public.defense_device_audit where device_id = context.device_id
        and event = 'status_changed' and previous_status = 'pending' and status = 'approved'
        and actor_role <> 'service_role' and requested_by = context.user_id) then
    raise exception 'approval_audit_missing';
  end if;
  begin
    update public.defense_device_audit set status = 'revoked' where device_id = context.device_id;
    raise exception 'audit_update_unexpected';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.defense_device_audit where device_id = context.device_id;
    raise exception 'audit_delete_unexpected';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
do $$
declare
  context record;
  context_json jsonb := current_setting('defense.device_check_context')::jsonb;
  after_hash text;
begin
  select context_json ->> 'device_id' as device_id, context_json ->> 'notes_hash' as notes_hash,
    context_json ->> 'audit_hash' as audit_hash into strict context;
  select encode(sha256(convert_to(jsonb_agg(to_jsonb(n) order by id)::text, 'UTF8')), 'hex')
    into after_hash from public.defense_notes n;
  if after_hash is distinct from context.notes_hash or (select count(*) from public.defense_notes) <> 4 then
    raise exception 'existing_notes_changed';
  end if;
  select encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(a) order by id)::text, '[]'), 'UTF8')), 'hex')
    into after_hash from public.defense_device_audit a where device_id <> context.device_id;
  if after_hash is distinct from context.audit_hash then raise exception 'existing_device_audit_changed'; end if;
end;
$$;
rollback;
select jsonb_build_object('pending_request', true, 'null_key_rejected', true, 'self_approval_denied', true,
  'public_access_denied', true, 'unapproved_nonce_denied', true, 'approved_nonce_claimed', true,
  'replay_denied', true, 'audit_preserved', true, 'notes_preserved', true,
  'test_rows_rolled_back', true) as checked;
