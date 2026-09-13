-- 012_adaptive_learning_schema.sql
-- نظام التعلّم التكيفي: أحداث تعليمية، ملف تعلم، تتبّع تقييمات، وتمديد ملفات المهارات.
-- لا يلمس الجداول الموجودة (profiles, chat_*, user_progress, diagnostic_*) سوى توسيع student_skill_profiles.

-- ============ 1. learning_events ============
create table if not exists public.learning_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (
    event_type in (
      'lesson_started', 'section_completed', 'quiz_started', 'question_answered',
      'quiz_completed', 'lesson_completed', 'unit_completed',
      'ai_explanation_requested', 'extra_example_requested', 'review_started',
      'assessment_started', 'assessment_completed', 'lesson_assessment_completed',
      'unit_assessment_completed'
    )
  ),
  unit_id text,
  lesson_id text,
  section_id text,
  question_id text,
  skill_id text,
  correct boolean,
  difficulty integer,
  event_data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists learning_events_student_idx on public.learning_events (student_id, created_at desc);
create index if not exists learning_events_event_idx on public.learning_events (event_type);
create index if not exists learning_events_skill_idx on public.learning_events (skill_id);

alter table public.learning_events enable row level security;

create policy "Students view own learning events"
  on public.learning_events for select
  to authenticated
  using ((select auth.uid()) = student_id);

create policy "Students insert own learning events"
  on public.learning_events for insert
  to authenticated
  with check ((select auth.uid()) = student_id);

-- ============ 2. student_learning_profile ============
create table if not exists public.student_learning_profile (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade unique,
  subject text not null default 'physics',
  overall_level text not null default 'beginner' check (
    overall_level in ('beginner', 'elementary', 'intermediate', 'good', 'advanced', 'mastery')
  ),
  overall_mastery numeric not null default 0 check (overall_mastery >= 0 and overall_mastery <= 100),
  skill_mastery jsonb not null default '{}'::jsonb,
  strengths jsonb not null default '[]'::jsonb,
  weaknesses jsonb not null default '[]'::jsonb,
  misconceptions jsonb not null default '[]'::jsonb,
  completed_content jsonb not null default '[]'::jsonb,
  recommended_content jsonb not null default '[]'::jsonb,
  assessment_history jsonb not null default '[]'::jsonb,
  learning_preferences jsonb not null default '{}'::jsonb,
  current_unit_id text,
  current_lesson_id text,
  next_action jsonb not null default '{"action": "continue"}'::jsonb,
  last_activity timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.student_learning_profile enable row level security;

create policy "Students view own learning profile"
  on public.student_learning_profile for select
  to authenticated
  using ((select auth.uid()) = student_id);

create policy "Students insert own learning profile"
  on public.student_learning_profile for insert
  to authenticated
  with check ((select auth.uid()) = student_id);

create policy "Students update own learning profile"
  on public.student_learning_profile for update
  to authenticated
  using ((select auth.uid()) = student_id)
  with check ((select auth.uid()) = student_id);

-- ============ 3. assessment_attempts ============
create table if not exists public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  assessment_type text not null check (
    assessment_type in ('micro', 'lesson', 'unit', 'diagnostic')
  ),
  assessment_id text not null,
  status text not null default 'in_progress' check (
    status in ('in_progress', 'completed', 'timed_out')
  ),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_seconds integer,
  total_questions integer not null default 0,
  correct_count integer not null default 0,
  score numeric check (score >= 0 and score <= 100),
  skill_results jsonb not null default '{}'::jsonb,
  recommendations jsonb not null default '[]'::jsonb
);

create index if not exists assessment_attempts_student_idx on public.assessment_attempts (student_id, started_at desc);
create index if not exists assessment_attempts_type_idx on public.assessment_attempts (assessment_type, assessment_id);

alter table public.assessment_attempts enable row level security;

create policy "Students view own assessment attempts"
  on public.assessment_attempts for select
  to authenticated
  using ((select auth.uid()) = student_id);

create policy "Students insert own assessment attempts"
  on public.assessment_attempts for insert
  to authenticated
  with check ((select auth.uid()) = student_id);

create policy "Students update own assessment attempts"
  on public.assessment_attempts for update
  to authenticated
  using ((select auth.uid()) = student_id)
  with check ((select auth.uid()) = student_id);

-- ============ 4. assessment_answers ============
create table if not exists public.assessment_answers (
  id bigint generated always as identity primary key,
  attempt_id uuid not null references public.assessment_attempts(id) on delete cascade,
  question_id text not null,
  section_id text,
  skill_id text,
  difficulty integer check (difficulty >= 1 and difficulty <= 5),
  selected_index integer,
  correct boolean not null default false,
  response_time_ms integer,
  error_type text check (
    error_type in (
      'conceptual', 'calculation', 'unit_error', 'formula_selection',
      'reading_error', 'graph_error', 'sign_direction', 'algebra_error',
      'random_mistake', 'unknown'
    )
  ),
  misconception_key text,
  created_at timestamptz not null default now()
);

create index if not exists assessment_answers_attempt_idx on public.assessment_answers (attempt_id);
create index if not exists assessment_answers_skill_idx on public.assessment_answers (skill_id);

alter table public.assessment_answers enable row level security;

create policy "Students view own assessment answers"
  on public.assessment_answers for select
  to authenticated
  using (exists (
    select 1 from public.assessment_attempts a
    where a.id = assessment_answers.attempt_id and a.student_id = auth.uid()
  ));

create policy "Students insert own assessment answers"
  on public.assessment_answers for insert
  to authenticated
  with check (exists (
    select 1 from public.assessment_attempts a
    where a.id = assessment_answers.attempt_id and a.student_id = auth.uid()
  ));

-- ============ 5. Extend student_skill_profiles ============
alter table public.student_skill_profiles
  add column if not exists confidence numeric default 0 check (confidence >= 0 and confidence <= 1);

alter table public.student_skill_profiles
  add column if not exists recent_performance jsonb not null default '[]'::jsonb;

alter table public.student_skill_profiles
  add column if not exists skill_meta jsonb not null default '{}'::jsonb;

-- ============ 6. updated_at trigger on new tables ============
drop trigger if exists trg_student_learning_profile_updated_at on public.student_learning_profile;
create trigger trg_student_learning_profile_updated_at
  before update on public.student_learning_profile
  for each row execute function public.handle_updated_at();

-- ============ 7. RPC: get_student_learning_context ============
-- يُرجع سياق التعلم الحالي للطالب من أجل AI ولوحة المعلومات.
create or replace function public.get_student_learning_context()
returns jsonb
language sql
security invoker
set search_path = ''
stable
as $$
  select coalesce(
    jsonb_build_object(
      'overall_level', p.overall_level,
      'overall_mastery', round(p.overall_mastery),
      'skill_mastery', p.skill_mastery,
      'strengths', p.strengths,
      'weaknesses', p.weaknesses,
      'misconceptions', p.misconceptions,
      'completed_content', p.completed_content,
      'recommended_content', p.recommended_content,
      'current_unit_id', p.current_unit_id,
      'current_lesson_id', p.current_lesson_id,
      'next_action', p.next_action,
      'updated_at', p.updated_at
    ),
    '{}'::jsonb
  )
  from public.student_learning_profile p
  where p.student_id = auth.uid();
$$;

revoke execute on function public.get_student_learning_context() from public, anon;
grant execute on function public.get_student_learning_context() to authenticated;