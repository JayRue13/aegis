-- Usage counter tests.
\set ON_ERROR_STOP 1
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
do $$ begin
  assert public.bump_usage() = 1, 'first bump is 1';
  assert public.bump_usage() = 2, 'second bump is 2';
  begin
    insert into usage_daily (user_id, messages) values ('11111111-1111-1111-1111-111111111111', -100);
    raise exception 'user reset own counter';
  exception when insufficient_privilege then null;
  end;
  update usage_daily set messages = 0;
  assert (select messages from usage_daily) = 2, 'user must not edit own counter';
end $$;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$ begin
  assert (select count(*) from usage_daily) = 0, 'B must not see A usage';
  assert public.bump_usage() = 1, 'B has own counter';
end $$;
reset role;
\echo 'Usage tests passed'
