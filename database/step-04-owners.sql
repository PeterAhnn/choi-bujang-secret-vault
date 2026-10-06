-- Step 4 maker 1: review-only template. Do not commit real email addresses.
-- Copy into a private official SQL editor and replace the two placeholders there.
-- Preserve the four original synthetic notes: rows 1-3 for A, row 4 for B.
begin;
do $$
declare
  a_email text := '[A 이메일]';
  b_email text := '[B 이메일]';
  a_id uuid;
  b_id uuid;
begin
  select id into strict a_id from auth.users where lower(email)=lower(trim(a_email));
  select id into strict b_id from auth.users where lower(email)=lower(trim(b_email));
  if a_id=b_id then raise exception 'A and B must be different accounts'; end if;
  if (select count(*) from public.defense_notes where id between 1 and 4)<>4 then
    raise exception 'Check the four original synthetic notes before assigning owners';
  end if;
  update public.defense_notes set owner_id=a_id where id in (1,2,3);
  update public.defense_notes set owner_id=b_id where id=4;
  if (select count(*) from public.defense_notes where id in (1,2,3) and owner_id=a_id)<>3
    or (select count(*) from public.defense_notes where id=4 and owner_id=b_id)<>1 then
    raise exception 'Synthetic note ownership mismatch';
  end if;
end $$;
commit;
-- Only role labels and counts are returned; no personal email, password or JWT.
select case when id in (1,2,3) then 'A' else 'B' end as sample_owner,
  count(*)::int as notes, count(owner_id)::int as assigned_notes
from public.defense_notes where id between 1 and 4 group by 1 order by 1;
