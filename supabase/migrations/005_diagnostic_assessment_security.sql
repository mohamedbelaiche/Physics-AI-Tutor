-- ============================================================
-- Migration 005: Diagnostic assessment security
--   * SECURITY DEFINER grading functions (correct answers never leave DB)
--   * Read-only client grants + Row Level Security
--   * Post-grading skill/diagnostic profiles + AI-ready context
-- Project: المدرس الشخصي للفيزياء
-- ============================================================

-- ------------------------------------------------------------
-- HELPERS (pure functions)
-- ------------------------------------------------------------
create or replace function public.diagnostic_mult(p_difficulty int)
returns numeric
language sql
immutable
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
as $$
  select case
           when p_score >= 75 then 'strength'
           when p_score >= 60 then 'good'
           when p_score >= 40 then 'weak'
           else 'critical'
         end;
$$;

-- ============================================================
-- build_diagnostic_report: assembles the JSON report of an attempt.
-- Only the authenticated owner can build a report for an attempt.
-- ============================================================
create or replace function public.build_diagnostic_report(
  p_attempt_id uuid,
  p_include_review boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_attempt public.diagnostic_attempts%rowtype;
  v_test public.diagnostic_tests%rowtype;
  v_profile public.student_diagnostic_profiles%rowtype;
  v_questions jsonb;
  v_context jsonb;
begin
  if v_uid is null then
    raise exception 'غير مصرح بهذا الإجراء' using errcode = '42501';
  end if;

  select * into v_attempt from public.diagnostic_attempts where id = p_attempt_id;
  if v_attempt is null then
    raise exception 'المحاولة غير موجودة';
  end if;
  if v_attempt.student_id <> v_uid then
    raise exception 'غير مصرح بالوصول إلى هذه المحاولة' using errcode = '42501';
  end if;

  select * into v_test from public.diagnostic_tests where id = v_attempt.test_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'question_id', q.id,
        'question', q.question_text,
        'skill', q.skill,
        'sub_skill', q.sub_skill,
        'difficulty', q.difficulty,
        'selected_option', a.selected_option,
        'is_correct', a.is_correct
      )
      ||
      case when p_include_review then
        jsonb_build_object(
          'options', q.options,
          'correct_option', q.correct_option,
          'explanation', q.explanation,
          'diagnostic_tags', q.diagnostic_tags
        )
      else
        '{}'::jsonb
      end
      order by q.id
    ),
    '[]'::jsonb
  ) into v_questions
  from public.diagnostic_answers a
  join public.diagnostic_questions q on q.id = a.question_id
  where a.attempt_id = p_attempt_id;

  select * into v_profile
  from public.student_diagnostic_profiles
  where student_id = v_attempt.student_id and last_attempt_id = v_attempt.id;

  v_context := jsonb_build_object(
    'subject', coalesce(v_profile.subject, 'physics'),
    'grade', 'baccalaureate',
    'overall', jsonb_build_object('score', coalesce(v_profile.overall_score, v_attempt.overall_score, 0), 'level', coalesce(v_profile.level, v_attempt.level, 1)),
    'strengths', coalesce(v_profile.strengths, '[]'::jsonb),
    'weaknesses', coalesce(v_profile.weaknesses, '[]'::jsonb),
    'critical_weaknesses', coalesce(v_profile.critical_weaknesses, '[]'::jsonb),
    'skill_map', coalesce(v_profile.skill_map, '{}'::jsonb),
    'recommended_start', coalesce(v_profile.recommended_start, 'baccalaureate_exams'),
    'recommended_learning_path', coalesce(v_profile.recommended_learning_path, '[]'::jsonb),
    'assessment_version', coalesce(v_profile.assessment_version, v_attempt.question_bank_version),
    'updated_at', coalesce(v_profile.updated_at, now())
  );

  return jsonb_build_object(
    'attempt_id', v_attempt.id,
    'test_id', v_attempt.test_id,
    'title', coalesce(v_test.title, ''),
    'test_version', v_attempt.test_version,
    'question_bank_version', v_attempt.question_bank_version,
    'status', v_attempt.status,
    'started_at', v_attempt.started_at,
    'completed_at', v_attempt.completed_at,
    'duration_seconds', v_attempt.duration_seconds,
    'overall_score', round(coalesce(v_profile.overall_score, v_attempt.overall_score, 0)::numeric),
    'level', coalesce(v_profile.level, v_attempt.level, 1),
    'answers_count', jsonb_array_length(
      coalesce((select jsonb_agg(a.id) from public.diagnostic_answers a where a.attempt_id = v_attempt.id), '[]'::jsonb)),
    'questions', v_questions,
    'skill_map', coalesce(v_profile.skill_map, '{}'::jsonb),
    'strengths', coalesce(v_profile.strengths, '[]'::jsonb),
    'weaknesses', coalesce(v_profile.weaknesses, '[]'::jsonb),
    'critical_weaknesses', coalesce(v_profile.critical_weaknesses, '[]'::jsonb),
    'recommended_start', coalesce(v_profile.recommended_start, 'baccalaureate_exams'),
    'recommended_learning_path', coalesce(v_profile.recommended_learning_path, '[]'::jsonb),
    'student_context', v_context
  );
end;
$$;

-- ============================================================
-- start_diagnostic_attempt: creates or resumes an attempt and
-- returns test metadata + questions WITHOUT any answer data.
-- ============================================================
create or replace function public.start_diagnostic_attempt(p_test_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_test public.diagnostic_tests%rowtype;
  v_attempt_id uuid;
  v_started_at timestamptz;
  v_draft jsonb;
  v_questions jsonb;
begin
  if v_uid is null then
    raise exception 'غير مصرح بهذا الإجراء' using errcode = '42501';
  end if;

  select * into v_test
  from public.diagnostic_tests
  where id = p_test_id and is_active = true;

  if v_test is null then
    raise exception 'الاختبار غير موجود أو غير مفعل';
  end if;

  select id, started_at, draft_answers into v_attempt_id, v_started_at, v_draft
  from public.diagnostic_attempts
  where student_id = v_uid and test_id = p_test_id and status = 'in_progress'
  order by started_at desc
  limit 1;

  if v_attempt_id is null then
    insert into public.diagnostic_attempts
      (student_id, test_id, test_version, question_bank_version, status)
    values (v_uid, v_test.id, v_test.version, v_test.question_bank_version, 'in_progress')
    returning id, started_at, draft_answers into v_attempt_id, v_started_at, v_draft;
  end if;

  -- SAFE projection: never includes correct_option / explanation / diagnostic_tags
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', q.id,
      'question_type', q.question_type,
      'question', q.question_text,
      'skill', q.skill,
      'primary_skill', q.primary_skill,
      'secondary_skill', q.secondary_skill,
      'sub_skill', q.sub_skill,
      'difficulty', q.difficulty,
      'weight', q.weight,
      'options', (select coalesce(jsonb_agg(jsonb_build_object('id', o ->> 'id', 'text', o ->> 'text')), '[]'::jsonb)
                  from jsonb_array_elements(q.options) o)
    ) order by q.id), '[]'::jsonb)
  into v_questions
  from public.diagnostic_questions q
  where q.test_id = p_test_id;

  return jsonb_build_object(
    'attempt_id', v_attempt_id,
    'started_at', v_started_at,
    'draft_answers', v_draft,
    'test', jsonb_build_object(
      'id', v_test.id,
      'title', v_test.title,
      'description', v_test.description,
      'subject', v_test.subject,
      'grade', v_test.grade,
      'test_version', v_test.version,
      'question_bank_version', v_test.question_bank_version,
      'total_questions', v_test.total_questions,
      'time_limit_minutes', v_test.time_limit_minutes
    ),
    'questions', v_questions
  );
end;
$$;

-- ============================================================
-- save_diagnostic_answers: persists the answers snapshot while the
-- student is taking the test (refresh / offline resilience).
-- p_answers: full snapshot object {question_id: option_id}.
-- ============================================================
create or replace function public.save_diagnostic_answers(
  p_attempt_id uuid,
  p_answers jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_attempt public.diagnostic_attempts%rowtype;
  v_entry record;
  v_q public.diagnostic_questions%rowtype;
  v_ok boolean;
begin
  if v_uid is null then
    raise exception 'غير مصرح بهذا الإجراء' using errcode = '42501';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception 'صيغة الأجوبة غير صالحة';
  end if;

  select * into v_attempt from public.diagnostic_attempts where id = p_attempt_id;
  if v_attempt is null then
    raise exception 'المحاولة غير موجودة';
  end if;
  if v_attempt.student_id <> v_uid then
    raise exception 'غير مصرح بالوصول إلى هذه المحاولة' using errcode = '42501';
  end if;
  if v_attempt.status <> 'in_progress' then
    raise exception 'لا يمكن تعديل محاولة منتهية';
  end if;

  for v_entry in select key, value::text as value from jsonb_each_text(p_answers)
  loop
    select * into v_q
    from public.diagnostic_questions
    where id = v_entry.key and test_id = v_attempt.test_id;
    if v_q is null then
      raise exception 'سؤال غير موجود في هذا الاختبار: %', v_entry.key;
    end if;
    select exists (
      select 1 from jsonb_array_elements(v_q.options) o where o ->> 'id' = v_entry.value
    ) into v_ok;
    if not v_ok then
      raise exception 'إجابة غير صالحة للسؤال: %', v_entry.key;
    end if;
  end loop;

  update public.diagnostic_attempts
  set draft_answers = p_answers
  where id = p_attempt_id;
end;
$$;

-- ============================================================
-- submit_diagnostic_attempt: grades deterministically, writes answers,
-- computes weighted/IRT-ready scores, levels, skill map, strengths,
-- weaknesses, recommended starting point and learning path. Idempotent.
-- ============================================================
create or replace function public.submit_diagnostic_attempt(
  p_attempt_id uuid,
  p_duration_seconds int default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_attempt public.diagnostic_attempts%rowtype;
  v_test public.diagnostic_tests%rowtype;
  v_q record;
  v_skill record;
  v_difficulty_mult numeric;
  v_weight numeric;
  v_total_weight numeric := 0;
  v_earned numeric := 0;
  v_option_id text;
  v_answered int := 0;
  v_correct int := 0;
  v_overall numeric := 0;
  v_level int := 1;
  v_score numeric;
  v_level_num int;
  v_status text;
  v_scores jsonb := '{}'::jsonb;
  v_map jsonb := '{}'::jsonb;
  v_strengths jsonb := '[]'::jsonb;
  v_weaknesses jsonb := '[]'::jsonb;
  v_critical jsonb := '[]'::jsonb;
  v_rec_start text := 'baccalaureate_exams';
  v_path jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    raise exception 'غير مصرح بهذا الإجراء' using errcode = '42501';
  end if;

  select * into v_attempt
  from public.diagnostic_attempts
  where id = p_attempt_id
  for update;

  if v_attempt is null then
    raise exception 'المحاولة غير موجودة';
  end if;
  if v_attempt.student_id <> v_uid then
    raise exception 'غير مصرح بالوصول إلى هذه المحاولة' using errcode = '42501';
  end if;

  select * into v_test from public.diagnostic_tests where id = v_attempt.test_id;
  if v_test is null then
    raise exception 'الاختبار غير موجود';
  end if;

  -- Idempotency: a second submit returns the stored report.
  if v_attempt.status <> 'in_progress' then
    return public.build_diagnostic_report(v_attempt.id);
  end if;

  delete from public.diagnostic_answers where attempt_id = v_attempt.id;

  for v_q in
    select * from public.diagnostic_questions
    where test_id = v_attempt.test_id
    order by id
  loop
    v_difficulty_mult := public.diagnostic_mult(v_q.difficulty);
    v_weight := v_q.weight * v_difficulty_mult;
    v_total_weight := v_total_weight + v_weight;

    v_option_id := coalesce(v_attempt.draft_answers ->> v_q.id, '');

    if v_option_id = v_q.correct_option then
      v_earned := v_earned + v_weight;
      v_correct := v_correct + 1;
    end if;
    if v_option_id <> '' then
      v_answered := v_answered + 1;
    end if;

    insert into public.diagnostic_answers
      (attempt_id, question_id, selected_option, is_correct,
       skill, sub_skill, difficulty, diagnostic_tags, answered_at)
    values
      (v_attempt.id, v_q.id,
       case when v_option_id <> '' then v_option_id else null end,
       v_option_id = v_q.correct_option,
       v_q.skill, v_q.sub_skill, v_q.difficulty, v_q.diagnostic_tags, now());

    -- live difficulty calibration statistics
    update public.diagnostic_questions
    set times_used = times_used + 1,
        times_correct = times_correct + case when v_option_id = v_q.correct_option then 1 else 0 end
    where id = v_q.id;
  end loop;

  v_overall := round((v_earned / nullif(v_total_weight, 0)) * 100);
  v_level := public.diagnostic_level(v_overall);

  for v_skill in
    select q.skill as skill,
           sum(q.weight * public.diagnostic_mult(q.difficulty)) as total_w,
           sum(case when a.is_correct then q.weight * public.diagnostic_mult(q.difficulty) else 0 end) as earned_w,
           count(*) as q_count,
           count(*) filter (where a.is_correct) as c_count
    from public.diagnostic_questions q
    left join public.diagnostic_answers a
      on a.question_id = q.id and a.attempt_id = v_attempt.id
    where q.test_id = v_attempt.test_id
    group by q.skill
    order by q.skill
  loop
    v_score := round((v_skill.earned_w / nullif(v_skill.total_w, 0)) * 100);
    v_level_num := public.diagnostic_level(v_score);
    v_status := public.diagnostic_status(v_score);

    insert into public.student_skill_profiles
      (student_id, subject, skill, score, level, status,
       questions_answered, correct_answers, last_assessment_id, updated_at)
    values
      (v_uid, v_test.subject, v_skill.skill, v_score, v_level_num, v_status,
       v_skill.q_count, v_skill.c_count, v_attempt.id, now())
    on conflict (student_id, subject, skill) do update
      set score = excluded.score,
          level = excluded.level,
          status = excluded.status,
          questions_answered = excluded.questions_answered,
          correct_answers = excluded.correct_answers,
          last_assessment_id = excluded.last_assessment_id,
          updated_at = now();

    v_scores := v_scores || jsonb_build_object(v_skill.skill, v_score);
    v_map := v_map || jsonb_build_object(v_skill.skill, jsonb_build_object(
      'score', v_score, 'level', v_level_num, 'status', v_status,
      'questions_answered', v_skill.q_count, 'correct_answers', v_skill.c_count));

    if v_status = 'strength' then
      v_strengths := v_strengths || jsonb_build_array(v_skill.skill);
    end if;
    if v_status in ('weak', 'critical') then
      v_weaknesses := v_weaknesses || jsonb_build_array(v_skill.skill);
    end if;
    if v_status = 'critical' then
      v_critical := v_critical || jsonb_build_array(v_skill.skill);
    end if;
  end loop;

  -- Recommended starting point (fixed diagnostic priority order)
  if (v_scores ->> 'math')::numeric < 50 then
    v_rec_start := 'math_foundations';
  elsif (v_scores ->> 'units')::numeric < 50 then
    v_rec_start := 'units_foundations';
  elsif (v_scores ->> 'problem_solving')::numeric < 50 then
    v_rec_start := 'problem_solving_foundations';
  elsif (v_scores ->> 'data')::numeric < 50 then
    v_rec_start := 'data_reading_foundations';
  elsif (v_scores ->> 'methodology')::numeric < 50 then
    v_rec_start := 'methodology_foundations';
  elsif (v_scores ->> 'concepts')::numeric < 50 then
    v_rec_start := 'concepts_foundations';
  end if;

  v_path := '[]'::jsonb;
  if v_rec_start = 'math_foundations' then
    v_path := v_path || jsonb_build_array(jsonb_build_object(
      'focus', 'math_foundations', 'title', 'الرياضيات الضرورية للفيزياء',
      'description', 'مراجعة التناسب والكتابة العلمية وإعادة ترتيب العلاقات قبل حل مسائل الفيزياء.'));
  end if;
  if v_rec_start = 'units_foundations' then
    v_path := v_path || jsonb_build_array(jsonb_build_object(
      'focus', 'units_foundations', 'title', 'الوحدات والتحويلات',
      'description', 'إتقان النظام الدولي للوحدات والتحويلات قبل تطبيق القوانين.'));
  end if;
  if v_rec_start = 'problem_solving_foundations' then
    v_path := v_path || jsonb_build_array(jsonb_build_object(
      'focus', 'problem_solving_foundations', 'title', 'منهجية حل المسألة',
      'description', 'استخراج المعطيات وتحديد المطلوب واختيار القانون المناسب ثم التعويض والتحقق.'));
  end if;
  if v_rec_start = 'data_reading_foundations' then
    v_path := v_path || jsonb_build_array(jsonb_build_object(
      'focus', 'data_reading_foundations', 'title', 'قراءة الجداول والمنحنيات',
      'description', 'قراءة المحاور وحساب الميل وتفسير المنحنيات وربطها بالقوانين.'));
  end if;
  if v_rec_start = 'methodology_foundations' then
    v_path := v_path || jsonb_build_array(jsonb_build_object(
      'focus', 'methodology_foundations', 'title', 'المنهجية والاستدلال',
      'description', 'تنظيم الحل واستعمال الرموز والوحدات والتبرير المنطقي لكل خطوة.'));
  end if;
  if v_rec_start = 'concepts_foundations' then
    v_path := v_path || jsonb_build_array(jsonb_build_object(
      'focus', 'concepts_foundations', 'title', 'المفاهيم الفيزيائية الأساسية',
      'description', 'فهم معنى كل قانون وعلاقاته مع الكميات الفيزيائية قبل التطبيق.'));
  end if;
  if v_rec_start = 'baccalaureate_exams' then
    v_path := v_path || jsonb_build_array(jsonb_build_object(
      'focus', 'baccalaureate_exams', 'title', 'تمارين البكالوريا مباشرة',
      'description', 'أساسياتك سليمة: انتقل إلى تمارين البكالوريا مع التركيز على المسائل المركّبة.'));
  end if;

  update public.diagnostic_attempts
  set status = 'submitted',
      completed_at = now(),
      duration_seconds = coalesce(p_duration_seconds, extract(epoch from (now() - v_attempt.started_at))::int),
      overall_score = v_overall,
      level = v_level
  where id = v_attempt.id;

  insert into public.student_diagnostic_profiles
    (student_id, subject, overall_score, level, strengths, weaknesses, critical_weaknesses,
     recommended_start, recommended_learning_path, skill_map, assessment_version,
     last_attempt_id, updated_at)
  values
    (v_uid, v_test.subject, v_overall, v_level, v_strengths, v_weaknesses, v_critical,
     v_rec_start, v_path, v_map, v_test.question_bank_version, v_attempt.id, now())
  on conflict (student_id, subject) do update
    set overall_score = excluded.overall_score,
        level = excluded.level,
        strengths = excluded.strengths,
        weaknesses = excluded.weaknesses,
        critical_weaknesses = excluded.critical_weaknesses,
        recommended_start = excluded.recommended_start,
        recommended_learning_path = excluded.recommended_learning_path,
        skill_map = excluded.skill_map,
        assessment_version = excluded.assessment_version,
        last_attempt_id = excluded.last_attempt_id,
        updated_at = now();

  return public.build_diagnostic_report(v_attempt.id);
end;
$$;

-- ============================================================
-- get_my_diagnostic_attempt: own attempt report (+ optional review)
-- ============================================================
create or replace function public.get_my_diagnostic_attempt(
  p_attempt_id uuid,
  p_include_review boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_attempt public.diagnostic_attempts%rowtype;
begin
  if v_uid is null then
    raise exception 'غير مصرح بهذا الإجراء' using errcode = '42501';
  end if;
  select * into v_attempt from public.diagnostic_attempts where id = p_attempt_id;
  if v_attempt is null then
    raise exception 'المحاولة غير موجودة';
  end if;
  if v_attempt.student_id <> v_uid then
    raise exception 'غير مصرح بالوصول إلى هذه المحاولة' using errcode = '42501';
  end if;
  return public.build_diagnostic_report(p_attempt_id, p_include_review);
end;
$$;

-- ============================================================
-- get_my_diagnostic_history: list of the student's attempts
-- ============================================================
create or replace function public.get_my_diagnostic_history()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_history jsonb;
begin
  if v_uid is null then
    raise exception 'غير مصرح بهذا الإجراء' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'attempt_id', a.id,
      'test_id', a.test_id,
      'title', coalesce(t.title, a.test_id),
      'test_version', a.test_version,
      'status', a.status,
      'started_at', a.started_at,
      'completed_at', a.completed_at,
      'duration_seconds', a.duration_seconds,
      'overall_score', round(a.overall_score::numeric),
      'level', a.level
    ) order by a.started_at desc), '[]'::jsonb)
  into v_history
  from public.diagnostic_attempts a
  left join public.diagnostic_tests t on t.id = a.test_id
  where a.student_id = v_uid;

  return v_history;
end;
$$;

-- ============================================================
-- get_student_diagnostic_context: AI-ready academic context blob.
-- Empty object {} if the student has no diagnostic profile yet.
-- ============================================================
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

-- ============================================================
-- GRANTS
-- ============================================================

-- No client access at all to the question bank (answers stay server-side)
revoke all on public.diagnostic_questions from public;
revoke all on public.diagnostic_questions from anon;
revoke all on public.diagnostic_questions from authenticated;

-- Read-only grants for the authenticated role on user-facing tables
revoke all on public.diagnostic_tests from public;
revoke all on public.diagnostic_attempts from public;
revoke all on public.diagnostic_answers from public;
revoke all on public.student_skill_profiles from public;
revoke all on public.student_diagnostic_profiles from public;

grant select on public.diagnostic_tests to authenticated;
grant select on public.diagnostic_attempts to authenticated;
grant select on public.diagnostic_answers to authenticated;
grant select on public.student_skill_profiles to authenticated;
grant select on public.student_diagnostic_profiles to authenticated;

-- Functions: only authenticated may invoke them (never anon / public)
revoke all on function public.diagnostic_mult(int) from public;
revoke all on function public.diagnostic_level(numeric) from public;
revoke all on function public.diagnostic_status(numeric) from public;
revoke all on function public.build_diagnostic_report(uuid, boolean) from public;
revoke all on function public.start_diagnostic_attempt(text) from public;
revoke all on function public.save_diagnostic_answers(uuid, jsonb) from public;
revoke all on function public.submit_diagnostic_attempt(uuid, int) from public;
revoke all on function public.get_my_diagnostic_attempt(uuid, boolean) from public;
revoke all on function public.get_my_diagnostic_history() from public;
revoke all on function public.get_student_diagnostic_context() from public;

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

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.diagnostic_tests enable row level security;
alter table public.diagnostic_questions enable row level security;
alter table public.diagnostic_attempts enable row level security;
alter table public.diagnostic_answers enable row level security;
alter table public.student_skill_profiles enable row level security;
alter table public.student_diagnostic_profiles enable row level security;

-- Tests: authenticated students can read active test metadata.
drop policy if exists "Students can view active tests" on public.diagnostic_tests;
create policy "Students can view active tests"
  on public.diagnostic_tests for select
  to authenticated
  using (is_active = true);

-- Question bank: deliberately no policies -> default deny (defense in depth).

-- Attempts: owner-only read.
drop policy if exists "Students view own attempts" on public.diagnostic_attempts;
create policy "Students view own attempts"
  on public.diagnostic_attempts for select
  to authenticated
  using (auth.uid() = student_id);

-- Answers: owner-only read, scoped through owns attempts.
drop policy if exists "Students view own answers" on public.diagnostic_answers;
create policy "Students view own answers"
  on public.diagnostic_answers for select
  to authenticated
  using (
    exists (
      select 1 from public.diagnostic_attempts a
      where a.id = attempt_id and a.student_id = auth.uid()
    )
  );

-- Skill profiles: owner-only read.
drop policy if exists "Students view own skill profiles" on public.student_skill_profiles;
create policy "Students view own skill profiles"
  on public.student_skill_profiles for select
  to authenticated
  using (auth.uid() = student_id);

-- Diagnostic profiles: owner-only read.
drop policy if exists "Students view own diagnostic profiles" on public.student_diagnostic_profiles;
create policy "Students view own diagnostic profiles"
  on public.student_diagnostic_profiles for select
  to authenticated
  using (auth.uid() = student_id);