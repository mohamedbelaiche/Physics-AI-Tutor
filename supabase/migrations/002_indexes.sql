-- ============================================================
-- Migration 002: Indexes & optimizations
-- Project: المدرس الشخصي للفيزياء
-- ============================================================

-- Speed up lookups by owner
create index if not exists chat_sessions_user_id_idx on public.chat_sessions (user_id);
create index if not exists chat_messages_session_id_idx on public.chat_messages (session_id);
create index if not exists user_progress_user_id_idx on public.user_progress (user_id);

-- Ensure profiles.updated_at bumps on change
drop trigger if exists set_timestamp_profiles on public.profiles;
create trigger set_timestamp_profiles
  before update on public.profiles
  for each row execute function public.handle_updated_at();

drop trigger if exists set_timestamp_chat_sessions on public.chat_sessions;
create trigger set_timestamp_chat_sessions
  before update on public.chat_sessions
  for each row execute function public.handle_updated_at();
