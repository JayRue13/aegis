-- Per-user daily message counts, so a shared AEGIS can cap usage per person
-- and keep free model quotas from being exhausted by one account.

create table if not exists public.usage_daily (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default current_date,
  messages integer not null default 0,
  primary key (user_id, day)
);

alter table public.usage_daily enable row level security;
drop policy if exists "read own usage" on public.usage_daily;
create policy "read own usage" on public.usage_daily for select to authenticated
  using (user_id = (select auth.uid()));
-- No insert/update policy: counts only change through bump_usage().

create or replace function public.bump_usage() returns integer
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); n integer;
begin
  if uid is null then raise exception 'not signed in'; end if;
  insert into public.usage_daily (user_id, day, messages) values (uid, current_date, 1)
  on conflict (user_id, day) do update set messages = public.usage_daily.messages + 1
  returning messages into n;
  return n;
end $$;

revoke all on function public.bump_usage() from public;
grant execute on function public.bump_usage() to authenticated;
