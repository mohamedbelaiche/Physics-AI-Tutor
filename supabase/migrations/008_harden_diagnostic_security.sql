-- Hardening pass after security advisory review:
--   1) Drop the temporary self-test function (it must never ship).
--   2) Revoke EXECUTE from anon explicitly on the diagnostic SECURITY DEFINER
--      functions (some had an explicit anon ACL entry; defense in depth).
--   3) Pin SET search_path on the pure helper functions (mutable search_path warn).
--   4) Covering indexes for unindexed foreign keys.
drop function if exists public.__tst_diag(uuid);

-- --- pure helpers: pin search_path ---
create or replace function public.diagnostic_mult(p_difficulty int)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case p_difficulty
           when 1 then 1.0
           when 2 then 1.2
           when 3 then 1.5
           when 4 then 2.0
           else 1.0
         end;
$$;

create or replace function public.diagnostic_level(p_score numeric)
returns int
language sql
immutable
set search_path = public
as $$
  select case
           when p_score >= 80 then 4
           when p_score >= 60 then 3
           when p_score >= 40 then 2
           else 1
         end;
$$;

create or replace function public.diagnostic_status(p_score numeric)
returns text
language sql
immutable
set search_path = public
as $$
  select case
           when p_score >= 75 then 'strength'
           when p_score >= 60 then 'good'
           when p_score >= 40 then 'weak'
           else 'critical'
         end;
$$;

-- --- revoke anon/public EXECUTE; keep authenticated only ---
revoke all on function public.diagnostic_mult(int) from public;
revoke all on function public.diagnostic_mult(int) from anon;
revoke all on function public.diagnostic_level(numeric) from public;
revoke all on function public.diagnostic_level(numeric) from anon;
revoke all on function public.diagnostic_status(numeric) from public;
revoke all on function public.diagnostic_status(numeric) from anon;
revoke all on function public.build_diagnostic_report(uuid, boolean) from public;
revoke all on function public.build_diagnostic_report(uuid, boolean) from anon;
revoke all on function public.start_diagnostic_attempt(text) from public;
revoke all on function public.start_diagnostic_attempt(text) from anon;
revoke all on function public.save_diagnostic_answers(uuid, jsonb) from public;
revoke all on function public.save_diagnostic_answers(uuid, jsonb) from anon;
revoke all on function public.submit_diagnostic_attempt(uuid, int) from public;
revoke all on function public.submit_diagnostic_attempt(uuid, int) from anon;
revoke all on function public.get_my_diagnostic_attempt(uuid, boolean) from public;
revoke all on function public.get_my_diagnostic_attempt(uuid, boolean) from anon;
revoke all on function public.get_my_diagnostic_history() from public;
revoke all on function public.get_my_diagnostic_history() from anon;
revoke all on function public.get_student_diagnostic_context() from public;
revoke all on function public.get_student_diagnostic_context() from anon;

grant execute on function public.diagnostic_mult(int) to authenticated;
grant execute on function public.diagnostic_level(numeric) to authenticated;
grant execute on function public.diagnostic_status(numeric) to authenticated;
grant execute on function public.build_diagnostic_report(uuid, boolean) to authenticated;
grant execute on function public.start_diagnostic_attempt(text) to authenticated;
grant execute on function public.save_diagnostic_answers(uuid, jsonb) to authenticated;
grant execute on function public.submit_diagnostic_attempt(uuid, int) to authenticated;
grant execute on function public.get_my_diagnostic_attempt(uuid, boolean) to authenticated;
grant execute on function public.get_my_diagnostic_history() to authenticated;
grant execute on function public.get_student_diagnostic_context() to authenticated;

-- --- covering indexes for unindexed foreign keys ---
create index if not exists diagnostic_answers_question_id_idx
  on public.diagnostic_answers (question_id);
create index if not exists student_diagnostic_profiles_last_attempt_id_idx
  on public.student_diagnostic_profiles (last_attempt_id);
create index if not exists student_skill_profiles_last_assessment_id_idx
  on public.student_skill_profiles (last_assessment_id);