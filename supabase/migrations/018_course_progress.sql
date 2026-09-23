-- ============================================================
-- Migration 018: Course progress (نظام الكورسات)
-- Project: المدرس الشخصي للفيزياء
-- تسجيل تقدم الطالب في الكورسات الخمسة (واحد لكل وحدة).
-- التتابع (فتح كورس بعد إتمام الذي قبله) يُفرض في api/course-progress.js.
-- ============================================================

-- 1) COURSE PROGRESS (status per user per course)
create table if not exists public.course_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id text not null,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed')),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, course_id)
);

create index if not exists course_progress_user_idx
  on public.course_progress (user_id);

-- updated_at trigger (نفس أسلوب migration 001)
drop trigger if exists set_timestamp_course_progress on public.course_progress;
create trigger set_timestamp_course_progress
  before update on public.course_progress
  for each row execute function public.handle_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (نفس نمط migrations 001/003)
-- ============================================================

alter table public.course_progress enable row level security;

revoke all on public.course_progress from anon, authenticated;
grant select, insert, update, delete on public.course_progress to authenticated;

drop policy if exists "Select own course progress" on public.course_progress;
drop policy if exists "Insert own course progress" on public.course_progress;
drop policy if exists "Update own course progress" on public.course_progress;
drop policy if exists "Delete own course progress" on public.course_progress;

create policy "Select own course progress"
  on public.course_progress for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Insert own course progress"
  on public.course_progress for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Update own course progress"
  on public.course_progress for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Delete own course progress"
  on public.course_progress for delete
  to authenticated
  using (auth.uid() = user_id);