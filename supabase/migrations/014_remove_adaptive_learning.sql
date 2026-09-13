-- 014_remove_adaptive_learning.sql
-- إزالة نظام التعلّم التكيفي (الدورة التعليمية) من قاعدة البيانات دون المساس بنظام التشخيص.

-- ============ 1. drop trigger on student_learning_profile ============
drop trigger if exists trg_student_learning_profile_updated_at on public.student_learning_profile;

-- ============ 2. drop assessment_answers (children first) ============
drop table if exists public.assessment_answers cascade;

-- ============ 3. drop assessment_attempts ============
drop table if exists public.assessment_attempts cascade;

-- ============ 4. drop learning_events ============
drop table if exists public.learning_events cascade;

-- ============ 5. drop student_learning_profile ============
drop table if exists public.student_learning_profile cascade;

-- ============ 6. drop RPC: get_student_learning_context ============
drop function if exists public.get_student_learning_context();

-- ============ 7. revert course extensions on student_skill_profiles ============
drop policy if exists "Students insert own skill profiles" on public.student_skill_profiles;
drop policy if exists "Students update own skill profiles" on public.student_skill_profiles;

alter table public.student_skill_profiles
  drop column if exists confidence;

alter table public.student_skill_profiles
  drop column if exists recent_performance;

alter table public.student_skill_profiles
  drop column if exists skill_meta;

-- ============ 8. remove applied-course migrations from the log ============
delete from public.migrations_log where name in ('012_adaptive_learning_schema.sql', '013_skill_profiles_write_policies.sql');