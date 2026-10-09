-- Row-level security tests. Fails (non-zero exit with ON_ERROR_STOP) if any
-- user can read or write another user's data.
\set ON_ERROR_STOP 1
grant all on all tables in schema public to authenticated;
insert into auth.users values
  ('11111111-1111-1111-1111-111111111111', 'a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.com');

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into conversations (id, title) values ('aaaaaaaa-0000-0000-0000-000000000001', 'A chat');
insert into messages (id, conversation_id, role, content)
  values ('aaaaaaaa-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-000000000001', 'user', 'hello saturn');
insert into memories (id, content) values ('aaaaaaaa-0000-0000-0000-0000000000b1', 'likes tea');
insert into projects (id, name) values ('aaaaaaaa-0000-0000-0000-0000000000c1', 'Thesis');

do $$ begin
  assert (select count(*) from conversations) = 1, 'owner should see own conversation';
  assert (select count(*) from messages where content ilike '%satu%') = 1, 'substring search should work';
end $$;

set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$ begin
  assert (select count(*) from conversations) = 0, 'B must not see A conversations';
  assert (select count(*) from messages) = 0, 'B must not see A messages';
  assert (select count(*) from memories) = 0, 'B must not see A memories';
  assert (select count(*) from projects) = 0, 'B must not see A projects';
end $$;

do $$ begin
  begin
    insert into messages (id, conversation_id, role, content)
      values ('bbbbbbbb-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-000000000001', 'user', 'sneaky');
    raise exception 'B inserted a message into A conversation';
  exception when raise_exception then
    if sqlerrm like 'B inserted%' then raise; end if;
  end;
  begin
    insert into memories (id, user_id, content)
      values ('bbbbbbbb-0000-0000-0000-0000000000b1', '11111111-1111-1111-1111-111111111111', 'planted');
    raise exception 'B planted a memory for A';
  exception when insufficient_privilege then null;
  end;
end $$;

update conversations set title = 'hacked';
delete from memories;

set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
do $$ begin
  assert (select title from conversations) = 'A chat', 'B must not modify A rows';
  assert (select count(*) from memories) = 1, 'B must not delete A rows';
end $$;

delete from conversations;
do $$ begin
  assert (select count(*) from messages) = 0, 'deleting a conversation removes its messages';
end $$;

reset role;
\echo 'RLS tests passed'
