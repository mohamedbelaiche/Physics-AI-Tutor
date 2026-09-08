-- ============================================================
-- Migration 001: Auth, Profiles, Chat tables with RLS
-- Project: المدرس الشخصي للفيزياء
-- ============================================================

-- 1) PROFILES table (one-to-one with auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  provider text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) CHAT SESSIONS (conversations per user)
create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text default 'محادثة جديدة',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3) CHAT MESSAGES (individual messages in a session)
create table if not exists public.chat_messages (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.chat_sessions (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

-- 4) USER PROGRESS (track which units/PDFs a user has opened)
create table if not exists public.user_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  unit_id text not null,
  opened_at timestamptz not null default now(),
  unique (user_id, unit_id)
);

-- updated_at trigger helper
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 5) Handle new user: create empty profile after signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, provider)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', new.email),
    new.raw_user_meta_data ->> 'avatar_url',
    coalesce(new.raw_user_meta_data ->> 'provider', 'email')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Trigger: automatically create a profile for every new auth user
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at triggers
drop trigger if exists set_timestamp_profiles on public.profiles;
create trigger set_timestamp_profiles
  before update on public.profiles
  for each row execute function public.handle_updated_at();

drop trigger if exists set_timestamp_chat_sessions on public.chat_sessions;
create trigger set_timestamp_chat_sessions
  before update on public.chat_sessions
  for each row execute function public.handle_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.user_progress enable row level security;

-- PROFILES: users can read/update their own profile only
create policy "Select own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- CHAT SESSIONS: owner-only
create policy "Select own chat sessions"
  on public.chat_sessions for select
  using (auth.uid() = user_id);

create policy "Insert own chat sessions"
  on public.chat_sessions for insert
  with check (auth.uid() = user_id);

create policy "Update own chat sessions"
  on public.chat_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Delete own chat sessions"
  on public.chat_sessions for delete
  using (auth.uid() = user_id);

-- CHAT MESSAGES: only via owner's session
create policy "Select messages of own sessions"
  on public.chat_messages for select
  using (
    exists (
      select 1 from public.chat_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

create policy "Insert messages into own sessions"
  on public.chat_messages for insert
  with check (
    exists (
      select 1 from public.chat_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

create policy "Delete messages of own sessions"
  on public.chat_messages for delete
  using (
    exists (
      select 1 from public.chat_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

-- USER PROGRESS: owner-only
create policy "Select own progress"
  on public.user_progress for select
  using (auth.uid() = user_id);

create policy "Insert own progress"
  on public.user_progress for insert
  with check (auth.uid() = user_id);

create policy "Update own progress"
  on public.user_progress for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Delete own progress"
  on public.user_progress for delete
  using (auth.uid() = user_id);

-- ============================================================
-- RLS helper so service uses JWT claims when available
-- ============================================================

-- Function to safely get provider from auth metadata
create or replace function public.get_user_provider()
returns text
language sql
stable
as $$
  select coalesce(
    (select raw_user_meta_data ->> 'provider' from auth.users where id = auth.uid()),
    'email'
  );
$$;
