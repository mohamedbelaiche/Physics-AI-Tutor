-- ============================================================
-- Migration 004: Diagnostic assessment tables
-- Project: المدرس الشخصي للفيزياء
-- System: اختبار تحديد مستوى البكالوريا في الفيزياء (تشخيصي)
-- ============================================================

-- 1) DIAGNOSTIC TESTS (test metadata / versions)
create table if not exists public.diagnostic_tests (
  id text primary key,
  title text not null,
  description text,
  subject text not null default 'physics',
  grade text not null default 'baccalaureate',
  version int not null default 1,
  question_bank_version text,
  total_questions int not null default 40,
  time_limit_minutes int not null default 60,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) DIAGNOSTIC QUESTIONS (question bank)
-- correct_option / explanation / diagnostic_tags are PROTECTED:
-- no client-side grant touches them; only SECURITY DEFINER functions read them.
create table if not exists public.diagnostic_questions (
  id text primary key,
  test_id text not null references public.diagnostic_tests (id) on delete cascade,
  question_type text not null default 'single_choice',
  skill text not null,
  primary_skill text,
  secondary_skill text,
  sub_skill text not null,
  difficulty int not null check (difficulty between 1 and 4),
  question_text text not null,
  options jsonb not null default '[]'::jsonb,
  correct_option text not null,
  explanation text,
  diagnostic_tags jsonb not null default '[]'::jsonb,
  weight numeric not null default 1 check (weight > 0),
  -- IRT / CAT readiness fields (calibration happens later)
  discrimination numeric not null default 1,
  calibrated_difficulty numeric,
  times_used int not null default 0,
  times_correct int not null default 0,
  created_at timestamptz not null default now(),
  unique (test_id, id)
);

-- 3) DIAGNOSTIC ATTEMPTS (one row per run of the test)
create table if not exists public.diagnostic_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users (id) on delete cascade,
  test_id text not null references public.diagnostic_tests (id),
  test_version int not null default 1,
  question_bank_version text,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'submitted', 'timed_out', 'expired')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_seconds int,
  -- snapshot of the student's answers {question_id: option_id}; graded server-side
  draft_answers jsonb not null default '{}'::jsonb,
  overall_score numeric,
  level int check (level between 1 and 4),
  created_at timestamptz not null default now()
);

-- 4) DIAGNOSTIC ANSWERS (graded, written only by the submit function)
create table if not exists public.diagnostic_answers (
  id bigint generated always as identity primary key,
  attempt_id uuid not null references public.diagnostic_attempts (id) on delete cascade,
  question_id text not null references public.diagnostic_questions (id),
  selected_option text,
  is_correct boolean not null default false,
  skill text not null,
  sub_skill text not null,
  difficulty int not null,
  diagnostic_tags jsonb not null default '[]'::jsonb,
  answered_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

-- 5) STUDENT SKILL PROFILES (one aggregated row per skill per student)
create table if not exists public.student_skill_profiles (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users (id) on delete cascade,
  subject text not null default 'physics',
  skill text not null,
  score numeric not null default 0,
  level int not null default 1 check (level between 1 and 4),
  status text not null default 'critical'
    check (status in ('strength', 'good', 'weak', 'critical')),
  questions_answered int not null default 0,
  correct_answers int not null default 0,
  last_assessment_id uuid references public.diagnostic_attempts (id),
  updated_at timestamptz not null default now(),
  unique (student_id, subject, skill)
);

-- 6) STUDENT DIAGNOSTIC PROFILES (overall diagnostic report per student per subject)
create table if not exists public.student_diagnostic_profiles (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users (id) on delete cascade,
  subject text not null default 'physics',
  overall_score numeric not null default 0,
  level int not null default 1 check (level between 1 and 4),
  strengths jsonb not null default '[]'::jsonb,
  weaknesses jsonb not null default '[]'::jsonb,
  critical_weaknesses jsonb not null default '[]'::jsonb,
  recommended_start text,
  recommended_learning_path jsonb not null default '[]'::jsonb,
  skill_map jsonb not null default '{}'::jsonb,
  assessment_version text,
  last_attempt_id uuid references public.diagnostic_attempts (id),
  updated_at timestamptz not null default now(),
  unique (student_id, subject)
);

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists diagnostic_questions_test_id_idx
  on public.diagnostic_questions (test_id);
create index if not exists diagnostic_questions_test_skill_idx
  on public.diagnostic_questions (test_id, skill);
create index if not exists diagnostic_questions_test_difficulty_idx
  on public.diagnostic_questions (test_id, difficulty);

create index if not exists diagnostic_attempts_student_id_idx
  on public.diagnostic_attempts (student_id);
create index if not exists diagnostic_attempts_student_status_idx
  on public.diagnostic_attempts (student_id, status);
create index if not exists diagnostic_attempts_test_id_idx
  on public.diagnostic_attempts (test_id);

create index if not exists diagnostic_answers_attempt_id_idx
  on public.diagnostic_answers (attempt_id);
create index if not exists diagnostic_answers_attempt_question_idx
  on public.diagnostic_answers (attempt_id, question_id);

create index if not exists student_skill_profiles_student_idx
  on public.student_skill_profiles (student_id, subject);
create index if not exists student_diagnostic_profiles_student_idx
  on public.student_diagnostic_profiles (student_id, subject);

-- ============================================================
-- updated_at triggers
-- ============================================================
drop trigger if exists set_timestamp_diagnostic_tests on public.diagnostic_tests;
create trigger set_timestamp_diagnostic_tests
  before update on public.diagnostic_tests
  for each row execute function public.handle_updated_at();

drop trigger if exists set_timestamp_student_skill_profiles on public.student_skill_profiles;
create trigger set_timestamp_student_skill_profiles
  before update on public.student_skill_profiles
  for each row execute function public.handle_updated_at();

drop trigger if exists set_timestamp_student_diagnostic_profiles on public.student_diagnostic_profiles;
create trigger set_timestamp_student_diagnostic_profiles
  before update on public.student_diagnostic_profiles
  for each row execute function public.handle_updated_at();