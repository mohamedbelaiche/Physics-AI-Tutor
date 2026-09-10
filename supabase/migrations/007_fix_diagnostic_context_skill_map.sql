-- Fix get_student_diagnostic_context: skill_map stores objects per skill
-- ({score, level, status, ...}), so reading the raw value as numeric failed
-- with "invalid input syntax for type numeric". Read the nested score instead.
create or replace function public.get_student_diagnostic_context()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ctx jsonb;
begin
  if v_uid is null then
    raise exception 'غير مصرح بهذا الإجراء' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'subject', p.subject,
    'grade', 'baccalaureate',
    'overall', jsonb_build_object('score', round(p.overall_score::numeric), 'level', p.level),
    'strengths', p.strengths,
    'weaknesses', p.weaknesses,
    'critical_weaknesses', p.critical_weaknesses,
    'skill_map', jsonb_build_object(
      'math', (p.skill_map -> 'math' ->> 'score')::numeric,
      'units', (p.skill_map -> 'units' ->> 'score')::numeric,
      'concepts', (p.skill_map -> 'concepts' ->> 'score')::numeric,
      'data', (p.skill_map -> 'data' ->> 'score')::numeric,
      'problem_solving', (p.skill_map -> 'problem_solving' ->> 'score')::numeric,
      'methodology', (p.skill_map -> 'methodology' ->> 'score')::numeric
    ),
    'recommended_start', p.recommended_start,
    'recommended_learning_path', p.recommended_learning_path,
    'assessment_version', p.assessment_version,
    'updated_at', p.updated_at
  )
  into v_ctx
  from public.student_diagnostic_profiles p
  where p.student_id = v_uid
  order by p.updated_at desc
  limit 1;

  return coalesce(v_ctx, '{}'::jsonb);
end;
$$;

revoke all on function public.get_student_diagnostic_context() from public;
revoke all on function public.get_student_diagnostic_context() from anon;
grant execute on function public.get_student_diagnostic_context() to authenticated;