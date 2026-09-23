-- ============================================================
-- Migration 019: Section progress (تقدم المقاطع والأجزاء)
-- Project: المدرس الشخصي للفيزياء
-- قياس التقدم على مستوى كل مقطع (section) وكل جزء (slide/نص) داخل الكورسات،
-- وليس فقط على مستوى الكورس. يُلغي التسلسل بين الكورسات (كلها مفتوحة)
-- ويُلغي التسلسل بين المقاطع (تُجتاز بأي ترتيب) — القرار معتمد من المالك.
--
-- جدول منفصل عام: يرتبط كل جزء (part) بحساب المستخدم مباشرةً، بلا رابط
-- لجداول إدارة المحتوى (لأن course.json قد يتغيّر) — نفتح فهرسًا فقط.
--
-- ملاحظة: لا نعتمد على auth.setSession هنا (يفشل بصمت في supabase-js v2)
-- بل نستدعي PostgREST مباشرةً بالتوكن الفعلي — تمامًا كما في
-- api/course-progress.js و api/supabase-server.js (نمط chat.js).
-- ============================================================

-- 1) منح أذونات الدور authenticated أولاً (قبل إنشاء RLS)
grant usage on schema public to authenticated;

-- 2) جدول تقدم المقاطع/الأجزاء
create table if not exists public.section_progress (
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  course_id text not null,
  section_id text not null,
  part_id text not null,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, course_id, section_id, part_id)
);

create index if not exists section_progress_user_idx
  on public.section_progress (user_id, course_id);

-- updated_at trigger (نفس أسلوب migration 001)
drop trigger if exists set_timestamp_section_progress on public.section_progress;
create trigger set_timestamp_section_progress
  before update on public.section_progress
  for each row execute function public.handle_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (نفس نمط migrations 001/003/018)
-- ============================================================

alter table public.section_progress enable row level security;

revoke all on public.section_progress from anon, authenticated;
grant select, insert, update, delete on public.section_progress to authenticated;

drop policy if exists "Select own section progress" on public.section_progress;
drop policy if exists "Insert own section progress" on public.section_progress;
drop policy if exists "Update own section progress" on public.section_progress;
drop policy if exists "Delete own section progress" on public.section_progress;

create policy "Select own section progress"
  on public.section_progress for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Insert own section progress"
  on public.section_progress for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Update own section progress"
  on public.section_progress for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Delete own section progress"
  on public.section_progress for delete
  to authenticated
  using (auth.uid() = user_id);
