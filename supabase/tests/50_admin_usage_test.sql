-- Admin usage overview tests.
\set ON_ERROR_STOP 1
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'B@Example.com')
on conflict (id) do update set email = excluded.email;
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$ begin
  assert not public.is_admin(), 'B is not an admin yet';
  begin
    perform * from public.usage_summary();
    raise exception 'non-admin read the usage summary';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.admins (email) values ('b@example.com');
    raise exception 'user made themselves admin';
  exception when insufficient_privilege then null;
  end;
  -- Either no privilege or no visible rows (RLS without policies) is fine.
  begin
    if exists (select 1 from public.admins) then raise exception 'user read the admin list'; end if;
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
insert into public.admins (email) values ('b@example.com') on conflict do nothing;
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$ declare a_today integer; begin
  assert public.is_admin(), 'B is admin (email match ignores case)';
  select today into a_today from public.usage_summary() where email = 'a@example.com';
  assert a_today = 2, 'admin sees A''s count from the usage tests';
  assert (select count(*) from public.usage_daily) = 1, 'admin still only reads own raw rows';
end $$;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
do $$ begin
  assert not public.is_admin(), 'A is not an admin';
end $$;
reset role;
\echo 'Admin usage tests passed'
