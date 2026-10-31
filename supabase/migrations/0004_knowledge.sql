-- Workspace knowledge files: plain text extracted from documents the user
-- adds to a workspace. AEGIS picks relevant excerpts for each message.
create table if not exists public.knowledge_files (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  content text not null check (char_length(content) <= 500000),
  created_at timestamptz not null default now()
);

create index if not exists knowledge_files_project on public.knowledge_files (project_id, created_at);

alter table public.knowledge_files enable row level security;
drop policy if exists "own rows" on public.knowledge_files;
create policy "own rows" on public.knowledge_files for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- A file may only be attached to a workspace the same user owns.
create or replace function public.knowledge_owner_check() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.projects p where p.id = new.project_id and p.user_id = new.user_id) then
    raise exception 'workspace does not belong to user';
  end if;
  return new;
end $$;

drop trigger if exists knowledge_owner_check on public.knowledge_files;
create trigger knowledge_owner_check before insert or update on public.knowledge_files
  for each row execute function public.knowledge_owner_check();
