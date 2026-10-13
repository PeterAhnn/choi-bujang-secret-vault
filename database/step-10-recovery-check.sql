-- Controlled B-owned synthetic note only. All test rows are rolled back.
begin;
set local role service_role;
do $$
declare
  actor_b uuid;
  actor_a uuid;
  target uuid := gen_random_uuid();
  trial_id integer;
  baseline text;
  restored jsonb;
begin
  if (select count(*) from public.defense_notes) <> 4 then raise exception 'expected_four_virtual_notes'; end if;
  select owner_id into actor_b from public.defense_notes group by owner_id having count(*) = 1;
  select owner_id into actor_a from public.defense_notes group by owner_id having count(*) = 3;
  if actor_a is null or actor_b is null or actor_a = actor_b then raise exception 'expected_virtual_a_b_owners'; end if;
  select least(-1, min(id) - 1) into trial_id from public.defense_notes;
  select encode(sha256(convert_to(jsonb_agg(to_jsonb(n) order by id)::text, 'UTF8')), 'hex')
    into baseline from public.defense_notes n;
  insert into public.defense_notes(id, note_id, owner_id, title, content)
    values (trial_id, target, actor_b, 'Synthetic restore title', 'Synthetic restore body');
  if not exists (select 1 from public.defense_note_backups where note_id = target and owner_id = actor_b) then
    raise exception 'snapshot_missing';
  end if;
  update public.defense_notes set content = 'Synthetic altered body' where note_id = target and owner_id = actor_b;
  restored := public.defense_restore_note(target, actor_b);
  if not exists (select 1 from public.defense_notes n join public.defense_note_backups b
      on n.note_id = b.note_id and n.owner_id = b.owner_id where n.note_id = target
      and n.id = b.source_id and n.title = b.title and n.content = b.content
      and restored->>'contentHash' = b.content_hash) then raise exception 'tamper_restore_failed'; end if;
  begin
    perform public.defense_restore_note(target, actor_a);
    raise exception 'foreign_restore_unexpected';
  exception when raise_exception then
    if sqlerrm <> 'backup_not_found' then raise; end if;
  end;
  delete from public.defense_notes where note_id = target and owner_id = actor_b;
  if not exists (select 1 from public.defense_note_backups where note_id = target and owner_id = actor_b) then
    raise exception 'snapshot_deleted_with_note';
  end if;
  -- A reusing B's deleted UUID must never be overwritten by B's old snapshot.
  insert into public.defense_notes(id, note_id, owner_id, title, content)
    values (trial_id - 1, target, actor_a, 'Synthetic collision title', 'Synthetic collision body');
  begin
    perform public.defense_restore_note(target, actor_b);
    raise exception 'collision_restore_unexpected';
  exception when raise_exception then
    if sqlerrm <> 'restore_denied' then raise; end if;
  end;
  if not exists (select 1 from public.defense_notes where note_id = target
      and owner_id = actor_a and content = 'Synthetic collision body') then raise exception 'foreign_row_changed'; end if;
  delete from public.defense_notes where note_id = target and owner_id = actor_a;
  restored := public.defense_restore_note(target, actor_b);
  if not exists (select 1 from public.defense_notes n join public.defense_note_backups b
      on n.note_id = b.note_id and n.owner_id = b.owner_id where n.note_id = target
      and n.id = b.source_id and n.title = b.title and n.content = b.content
      and restored->>'contentHash' = b.content_hash) then raise exception 'delete_restore_failed'; end if;
  if (select count(*) from public.defense_note_recovery_audit where note_id = target and owner_id = actor_b) <> 2 then
    raise exception 'audit_not_preserved';
  end if;
  if baseline <> (select encode(sha256(convert_to(jsonb_agg(to_jsonb(n) order by id)::text, 'UTF8')), 'hex')
      from public.defense_notes n where note_id <> target) then raise exception 'unrelated_notes_changed'; end if;
end;
$$;
rollback;
select jsonb_build_object('tamper_restore',true,'delete_restore',true,'foreign_denied',true,
  'owner_collision_denied',true,'audit_preserved',true,'test_rows_rolled_back',true) as checked;
