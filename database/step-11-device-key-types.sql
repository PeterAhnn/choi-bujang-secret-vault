-- Tighten the already-applied device policy; no existing notes or approvals are changed.
begin;
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.defense_devices'::regclass
      and conname = 'defense_devices_public_key_types') then
    alter table public.defense_devices add constraint defense_devices_public_key_types check (
      coalesce(jsonb_typeof(public_jwk -> 'kty') = 'string'
        and jsonb_typeof(public_jwk -> 'crv') = 'string', false));
  end if;
end;
$$;
commit;
