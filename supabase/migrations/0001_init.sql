-- AEGIS initial schema. Run in the Supabase SQL editor (or `supabase db push`).
-- Every table is protected by row-level security: a user can only read and
-- write rows where user_id = auth.uid().

create table if not exists public.projects (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null check (char_length(name) between 1 and 200),
  instructions text not null default '' check (char_length(instructions) <= 20000),
  created_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  project_id uuid references public.projects (id) on delete set null,
  title text not null default 'New chat',
  model text,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null default '',
  model text,
  error boolean not null default false,
  attachments jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.memories (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  content text not null check (char_length(content) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists conversations_user_updated on public.conversations (user_id, updated_at desc);
create index if not exists messages_conversation_created on public.messages (conversation_id, created_at);
create index if not exists memories_user_created on public.memories (user_id, created_at desc);

-- Trigram index so the sidebar's substring search (ILIKE) stays fast.
create extension if not exists pg_trgm;
create index if not exists messages_content_trgm on public.messages using gin (content gin_trgm_ops);

alter table public.projects enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.memories enable row level security;

do $$
declare t text;
begin
  foreach t in array array['projects', 'conversations', 'messages', 'memories'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- A message may only be attached to a conversation the same user owns.
create or replace function public.messages_owner_check() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.conversations c where c.id = new.conversation_id and c.user_id = new.user_id) then
    raise exception 'conversation does not belong to user';
  end if;
  return new;
end $$;

drop trigger if exists messages_owner_check on public.messages;
create trigger messages_owner_check before insert or update on public.messages
  for each row execute function public.messages_owner_check();
