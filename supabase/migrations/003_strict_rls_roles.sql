-- ============================================================
-- Migration 003: Tighten RLS policies to authenticated role only
-- Project: المدرس الشخصي للفيزياء
-- ============================================================

-- Revoke all privileges from anon (unauthenticated) on user tables.
-- These tables only contain user-owned data; anon has no business here.
revoke all on public.profiles from anon, authenticated;
revoke all on public.chat_sessions from anon, authenticated;
revoke all on public.chat_messages from anon, authenticated;
revoke all on public.user_progress from anon, authenticated;

-- The Data API (PostgREST) needs explicit grants for anon/authenticated
-- to use these tables at all (separate from RLS, which filters rows).
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.chat_sessions to authenticated;
grant select, insert, update, delete on public.chat_messages to authenticated;
grant select, insert, update, delete on public.user_progress to authenticated;

-- Drop and recreate policies scoped to the authenticated role only.
drop policy if exists "Select own profile" on public.profiles;
drop policy if exists "Update own profile" on public.profiles;

create policy "Select own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "Update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Select own chat sessions" on public.chat_sessions;
drop policy if exists "Insert own chat sessions" on public.chat_sessions;
drop policy if exists "Update own chat sessions" on public.chat_sessions;
drop policy if exists "Delete own chat sessions" on public.chat_sessions;

create policy "Select own chat sessions"
  on public.chat_sessions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Insert own chat sessions"
  on public.chat_sessions for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Update own chat sessions"
  on public.chat_sessions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Delete own chat sessions"
  on public.chat_sessions for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Select messages of own sessions" on public.chat_messages;
drop policy if exists "Insert messages into own sessions" on public.chat_messages;
drop policy if exists "Delete messages of own sessions" on public.chat_messages;

create policy "Select messages of own sessions"
  on public.chat_messages for select
  to authenticated
  using (
    exists (
      select 1 from public.chat_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

create policy "Insert messages into own sessions"
  on public.chat_messages for insert
  to authenticated
  with check (
    exists (
      select 1 from public.chat_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

create policy "Delete messages of own sessions"
  on public.chat_messages for delete
  to authenticated
  using (
    exists (
      select 1 from public.chat_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

drop policy if exists "Select own progress" on public.user_progress;
drop policy if exists "Insert own progress" on public.user_progress;
drop policy if exists "Update own progress" on public.user_progress;
drop policy if exists "Delete own progress" on public.user_progress;

create policy "Select own progress"
  on public.user_progress for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Insert own progress"
  on public.user_progress for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Update own progress"
  on public.user_progress for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Delete own progress"
  on public.user_progress for delete
  to authenticated
  using (auth.uid() = user_id);