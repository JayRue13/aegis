-- Usage overview for admins. Admins are listed by email in public.admins,
-- which nobody can read or change through the API (RLS on, no policies);
-- add yourself once in the Supabase SQL editor:
--   insert into public.admins (email) values ('you@example.com');
-- usage_summary() returns per-person message counts only to admins.

create table if not exists public.admins (
  email text primary key check (email = lower(email))
);
alter table public.admins enable row level security;
revoke all on public.admins from public, authenticated;
do $$ begin revoke all on public.admins from anon; exception when undefined_object then null; end $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admins a join auth.users u on lower(u.email) = a.email
    where u.id = auth.uid()
  )
$$;

create or replace function public.usage_summary()
returns table (email text, today integer, last_7_days integer, last_30_days integer, last_active date)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  return query
    select u.email::text,
      coalesce(sum(d.messages) filter (where d.day = current_date), 0)::integer,
      coalesce(sum(d.messages) filter (where d.day > current_date - 7), 0)::integer,
      coalesce(sum(d.messages), 0)::integer,
      max(d.day)
    from public.usage_daily d join auth.users u on u.id = d.user_id
    where d.day > current_date - 30
    group by u.email
    order by 4 desc, 1;
end $$;

revoke all on function public.is_admin() from public;
revoke all on function public.usage_summary() from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.usage_summary() to authenticated;
