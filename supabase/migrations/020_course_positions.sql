-- ============================================================
-- Migration 020: Course positions (استئناف الموقع داخل الكورس)
-- Project: المدرس الشخصي للفيزياء
--
-- يخزّن آخر موضع للمستخدم داخل كل كورس (القسم/المقطع + الشريحة + الوضع)
-- بحيث عند فتح الكورس من جديد يُستأنف من نفس القسم والشريحة التي كان عليها.
-- صف واحد لكل مستخدم/كورس (PK user_id,course_id).
--
-- نفس نمط 018/019: جدول منفصل عام، PostgREST مباشرةً بالتوكن، RLS للـ
-- authenticated فقط. position.section_id نصّ (num المقطع) — قد يتغيّر
-- course.json، لذلك لا نربط بجداول المحتوى.
-- ============================================================

-- 1) منح أذونات الدور authenticated أولاً (قبل إنشاء RLS)
grant usage on schema public to authenticated;

-- 2) جدول مواقع الاستئناف
create table if not exists public.course_positions (
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id text not null,
  section_id text not null,
  slide_index integer not null default 0,
  mode text not null default 'text' check (mode in ('text', 'slides')),
  updated_at timestamptz not null default now(),
  primary key (user_id, course_id)
);

create index if not exists course_positions_user_idx
  on public.course_positions (user_id);

-- updated_at trigger (نفس أسلوب migration 001)
drop trigger if exists set_timestamp_course_positions on public.course_positions;
create trigger set_timestamp_course_positions
  before update on public.course_positions
  for each row execute function public.handle_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (نفس نمط migrations 001/003/018/019)
-- ============================================================

alter table public.course_positions enable row level security;

revoke all on public.course_positions from anon, authenticated;
grant select, insert, update, delete on public.course_positions to authenticated;

drop policy if exists "Select own course position" on public.course_positions;
drop policy if exists "Insert own course position" on public.course_positions;
drop policy if exists "Update own course position" on public.course_positions;
drop policy if exists "Delete own course position" on public.course_positions;

create policy "Select own course position"
  on public.course_positions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Insert own course position"
  on public.course_positions for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Update own course position"
  on public.course_positions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Delete own course position"
  on public.course_positions for delete
  to authenticated
  using (auth.uid() = user_id);