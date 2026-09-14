-- 015_course_schema.sql
-- بنية الدورة التعليمية التتابعية + التعلّم التكيّفي (مستقلة عن نظام التشخيص).

-- ===== course_progress: حالة عقدة (عنصر/درس/وحدة/امتحان نهائي) =====
create table if not exists public.course_progress (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  ref_type text not null check (ref_type in ('element','lesson','unit','exam_final')),
  ref_id text not null,
  status text not null default 'locked' check (status in ('locked','in_progress','completed','passed')),
  best_score integer check (best_score between 0 and 100),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, ref_type, ref_id)
);

-- ===== course_exam_attempts: محاولة امتحان (درس/وحدة/نهائي) =====
create table if not exists public.course_exam_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  exam_type text not null check (exam_type in ('lesson','unit','final')),
  ref_id text not null,
  total_questions integer not null,
  correct_count integer not null default 0,
  score integer not null default 0 check (score between 0 and 100),
  passed boolean not null default false,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  duration_sec integer
);

-- ===== course_exam_answers: إجابة كل سؤال في كل محاولة =====
create table if not exists public.course_exam_answers (
  id bigint generated always as identity primary key,
  attempt_id uuid not null references public.course_exam_attempts (id) on delete cascade,
  question_id text not null,
  skill text not null,
  difficulty integer not null,
  selected_index integer,
  is_correct boolean not null default false,
  response_time_sec integer
);

-- ===== course_skill_profiles: إتقان الطالب لكل مهارة على مستوى الدورة =====
create table if not exists public.course_skill_profiles (
  user_id uuid not null references auth.users (id) on delete cascade,
  skill text not null,
  mastery integer not null default 0 check (mastery between 0 and 100),
  n integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, skill)
);

-- ===== student_learning_profile: نبذة الطالب ونقاط القوة/الضعف =====
create table if not exists public.student_learning_profile (
  user_id uuid primary key references auth.users (id) on delete cascade,
  overall_mastery integer not null default 0 check (overall_mastery between 0 and 100),
  overall_level text,
  strengths text[] not null default '{}',
  weaknesses text[] not null default '{}',
  current_position jsonb,
  adaptation_overrides jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- ===== RLS =====
alter table public.course_progress enable row level security;
alter table public.course_exam_attempts enable row level security;
alter table public.course_exam_answers enable row level security;
alter table public.course_skill_profiles enable row level security;
alter table public.student_learning_profile enable row level security;

create policy "Own course_progress select" on public.course_progress for select using (auth.uid() = user_id);
create policy "Own course_progress insert" on public.course_progress for insert with check (auth.uid() = user_id);
create policy "Own course_progress update" on public.course_progress for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Own course_exam_attempts select" on public.course_exam_attempts for select using (auth.uid() = user_id);
create policy "Own course_exam_attempts insert" on public.course_exam_attempts for insert with check (auth.uid() = user_id);
create policy "Own course_exam_attempts update" on public.course_exam_attempts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Own course_exam_answers select" on public.course_exam_answers for select using (
  exists (select 1 from public.course_exam_attempts a where a.id = attempt_id and a.user_id = auth.uid())
);
create policy "Own course_exam_answers insert" on public.course_exam_answers for insert with check (
  exists (select 1 from public.course_exam_attempts a where a.id = attempt_id and a.user_id = auth.uid())
);

create policy "Own course_skill_profiles select" on public.course_skill_profiles for select using (auth.uid() = user_id);
create policy "Own course_skill_profiles insert" on public.course_skill_profiles for insert with check (auth.uid() = user_id);
create policy "Own course_skill_profiles update" on public.course_skill_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Own student_learning_profile select" on public.student_learning_profile for select using (auth.uid() = user_id);
create policy "Own student_learning_profile insert" on public.student_learning_profile for insert with check (auth.uid() = user_id);
create policy "Own student_learning_profile update" on public.student_learning_profile for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ===== updated_at triggers =====
drop trigger if exists set_timestamp_course_progress on public.course_progress;
create trigger set_timestamp_course_progress
  before update on public.course_progress
  for each row execute function public.handle_updated_at();

drop trigger if exists set_timestamp_course_skill_profiles on public.course_skill_profiles;
create trigger set_timestamp_course_skill_profiles
  before update on public.course_skill_profiles
  for each row execute function public.handle_updated_at();

drop trigger if exists set_timestamp_student_learning_profile on public.student_learning_profile;
create trigger set_timestamp_student_learning_profile
  before update on public.student_learning_profile
  for each row execute function public.handle_updated_at();

-- ===== RPC: سياق الدورة للمدرّس الذكي ولنقطة التكيّف =====
create or replace function public.get_student_course_context()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'learning_profile', (select to_jsonb(lp) from public.student_learning_profile lp where lp.user_id = auth.uid()),
    'skill_mastery', (select coalesce(jsonb_object_agg(skill, jsonb_build_object('mastery', mastery, 'n', n)), '{}'::jsonb)
                      from public.course_skill_profiles where user_id = auth.uid()),
    'progress', (select coalesce(jsonb_object_agg(ref_type || ':' || ref_id, jsonb_build_object('status', status, 'best_score', best_score)), '{}'::jsonb)
                 from public.course_progress where user_id = auth.uid())
  );
$$;

-- ===== إصلاح أمني: تفعيل RLS على migrations_log =====
alter table public.migrations_log enable row level security;
drop policy if exists "migrations_log readable by authenticated" on public.migrations_log;
create policy "migrations_log readable by authenticated"
  on public.migrations_log for select
  using (auth.role() = 'authenticated');