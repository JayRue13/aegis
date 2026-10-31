-- Workspace knowledge file tests.
\set ON_ERROR_STOP 1
grant all on all tables in schema public to authenticated;
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into projects (id, name) values ('aaaaaaaa-0000-0000-0000-0000000000d1', 'Research');
insert into knowledge_files (id, project_id, name, content)
  values ('aaaaaaaa-0000-0000-0000-0000000000e1', 'aaaaaaaa-0000-0000-0000-0000000000d1', 'notes.md', 'orbital mechanics');
do $$ begin
  assert (select count(*) from knowledge_files) = 1, 'owner sees own file';
end $$;

set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$ begin
  assert (select count(*) from knowledge_files) = 0, 'B must not see A files';
  begin
    insert into knowledge_files (id, project_id, name, content)
      values ('bbbbbbbb-0000-0000-0000-0000000000e1', 'aaaaaaaa-0000-0000-0000-0000000000d1', 'x', 'planted');
    raise exception 'B attached a file to A workspace';
  exception when raise_exception then
    if sqlerrm like 'B attached%' then raise; end if;
  end;
end $$;
delete from knowledge_files;

set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
do $$ begin
  assert (select count(*) from knowledge_files) = 1, 'B must not delete A files';
end $$;
delete from projects where id = 'aaaaaaaa-0000-0000-0000-0000000000d1';
do $$ begin
  assert (select count(*) from knowledge_files) = 0, 'deleting a workspace removes its files';
end $$;
reset role;
\echo 'Knowledge tests passed'
