-- Storage policy tests: users can only read and write their own folder.
\set ON_ERROR_STOP 1
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into storage.objects (bucket_id, name) values ('attachments', '11111111-1111-1111-1111-111111111111/c1/m1-0.jpg');
do $$ begin
  begin
    insert into storage.objects (bucket_id, name) values ('attachments', '22222222-2222-2222-2222-222222222222/c1/evil.jpg');
    raise exception 'A wrote into B folder';
  exception when insufficient_privilege then null;
  end;
end $$;

set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$ begin
  assert (select count(*) from storage.objects) = 0, 'B must not see A files';
end $$;
delete from storage.objects;

set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
do $$ begin
  assert (select count(*) from storage.objects) = 1, 'A file must survive B delete attempt';
end $$;
reset role;
\echo 'Storage tests passed'
