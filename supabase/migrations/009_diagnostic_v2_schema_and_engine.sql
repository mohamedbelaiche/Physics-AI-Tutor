-- ============================================================
-- Migration 009: Diagnostic v2 engine (bac-physics-v2)
--   * difficulty/level scales extended 1..5
--   * prior-year scores (physics + math, 0..20) → Prior Signal
--   * diagnostic_skill_defs (16 skills of the approved skill map)
--   * v2 scoring engine + Critical/Important/Minor learning path
--   * dimension averages (math/physics/scientific/…) in reports
-- Sources of truth (keep in sync):
--   * KNOWLEDGE_BASE/diagnostic/skill_map.json
--   * scripts/question-bank-v2.js
-- ============================================================

-- ------------------------------------------------------------
-- 1) SCHEMA: extend scales to L5 (v2 uses difficulty 1..5)
-- ------------------------------------------------------------
alter table public.diagnostic_questions
  drop constraint if exists diagnostic_questions_difficulty_check;
alter table public.diagnostic_questions
  add constraint diagnostic_questions_difficulty_check
  check (difficulty between 1 and 5);

alter table public.diagnostic_attempts
  drop constraint if exists diagnostic_attempts_level_check;
alter table public.diagnostic_attempts
  add constraint diagnostic_attempts_level_check
  check (level between 1 and 5);

alter table public.student_skill_profiles
  drop constraint if exists student_skill_profiles_level_check;
alter table public.student_skill_profiles
  add constraint student_skill_profiles_level_check
  check (level between 1 and 5);

alter table public.student_diagnostic_profiles
  drop constraint if exists student_diagnostic_profiles_level_check;
alter table public.student_diagnostic_profiles
  add constraint student_diagnostic_profiles_level_check
  check (level between 1 and 5);

-- Prior-year scores: a Prior Performance Signal only. They are stored
-- but NEVER mixed into the skill diagnosis / overall score.
alter table public.diagnostic_attempts
  add column if not exists prior_physics_score numeric;
alter table public.diagnostic_attempts
  add column if not exists prior_math_score numeric;
alter table public.diagnostic_attempts
  drop constraint if exists diagnostic_attempts_prior_physics_score_check;
alter table public.diagnostic_attempts
  add constraint diagnostic_attempts_prior_physics_score_check
  check (prior_physics_score between 0 and 20);
alter table public.diagnostic_attempts
  drop constraint if exists diagnostic_attempts_prior_math_score_check;
alter table public.diagnostic_attempts
  add constraint diagnostic_attempts_prior_math_score_check
  check (prior_math_score between 0 and 20);

alter table public.student_diagnostic_profiles
  add column if not exists dimensions jsonb not null default '{}'::jsonb;
alter table public.student_diagnostic_profiles
  add column if not exists prior_scores jsonb not null default '{}'::jsonb;

-- ------------------------------------------------------------
-- 2) DIAGNOSTIC SKILL DEFINITIONS (16 skills, approved skill map)
-- ------------------------------------------------------------
create table if not exists public.diagnostic_skill_defs (
  skill_id text primary key,
  category text not null check (category in ('A', 'B', 'C')),
  title_ar text not null,
  title_en text,
  importance text not null check (importance in ('critical', 'important', 'minor')),
  prerequisite_for jsonb not null default '[]'::jsonb,
  difficulty_levels jsonb not null default '[]'::jsonb,
  planned_questions int not null default 0,
  link_to_taxonomy jsonb not null default '[]'::jsonb,
  why_prerequisite text,
  skill_order int not null,
  unique (skill_order)
);

insert into public.diagnostic_skill_defs
  (skill_id, category, title_ar, title_en, importance, prerequisite_for, difficulty_levels, planned_questions, link_to_taxonomy, why_prerequisite, skill_order)
values
  ('mat-num', 'A', 'الحساب بالقوى والكتابة العلمية', 'Powers of ten & scientific notation', 'critical', '["unit1","unit2","unit3","unit4","unit5"]', '[1,2]', 4, '["sk_calculate"]', 'كل الوحدات تستعمل قوى العدد 10 في عُشرها والسوابق μ,n,p وتحويلات الوحدات.', 1),
  ('mat-unitconv', 'A', 'تحويل الوحدات (النظام الدولي)', 'Unit conversion (SI)', 'critical', '["unit1","unit2","unit3","unit4","unit5"]', '[1,2,3]', 4, '["sk_units"]', 'الوحدة 1 تُعلن تحويلات معلنة، والوحدة 2 uma↔kg↔MeV↔J، والوحدة 5 km/h↔m/s.', 2),
  ('mat-algebra', 'A', 'عزل المتغير وإعادة ترتيب العلاقات', 'Algebra & isolating variables', 'critical', '["unit1","unit2","unit3","unit4","unit5"]', '[2,3,4]', 4, '["sk_calculate"]', 'كل مسألة تعتمد على عزل مجهول من علاقة: m=nM، r=GM/v²، t½=ln2/λ.', 3),
  ('mat-proportion', 'A', 'التناسب والكسور والنسب المئوية', 'Proportional reasoning & percentages', 'critical', '["unit1","unit2","unit3","unit4","unit5"]', '[1,2,3,4]', 4, '["sk_calculate"]', 'معامل التمديد، درجة النقاوة، النسب الستوكيومترية، T²/a³، تخفيض نصف النشاط.', 4),
  ('mat-logexp', 'A', 'الدوال الأسية واللوغاريتمية', 'Exponential & logarithmic functions', 'critical', '["unit2","unit3","unit4","unit5"]', '[2,3,4]', 4, '["sk_calculate","sk_justify"]', 'التناقص الإشعاعي، حلول RC/RL الأسية، pH و10^(−pH)، السرعة الحدية.', 5),
  ('mat-calc', 'A', 'الاشتقاق والتكامل', 'Differentiation & integration', 'critical', '["unit1","unit3","unit5"]', '[2,3,4]', 3, '["sk_modelize","sk_calculate"]', 'سرعة التفاعل v=dx/dt، المعادلات التفاضلية، v=dOM/dt و a=dv/dt.', 6),
  ('mat-vectrig', 'A', 'المثلثات والمتجهات (مركبات وإسقاط)', 'Vectors & trigonometry', 'important', '["unit5"]', '[2,3,4]', 3, '["sk_modelize","sk_calculate"]', 'مركبات vx,vz، الإسقاط cos/sin، الشغل W=F·AB·cosα.', 7),
  ('phy-graph', 'B', 'قراءة واستغلال المنحنيات', 'Graph reading & exploitation', 'critical', '["unit1","unit2","unit3","unit5"]', '[2,3,4]', 4, '["sk_graph","sk_justify"]', 'x=f(t)، lnN=f(t)، uC=f(t) وتعيين τ، v=f(t) والمساحة=المسافة.', 8),
  ('phy-table', 'B', 'قراءة الجداول وتحديد الأنماط', 'Data tables & patterns', 'important', '["unit1","unit4","unit5"]', '[2,3]', 2, '["sk_graph","sk_calculate"]', 'جداول التتبع الزمني، جدول التقدم، التصوير المتعاقب.', 9),
  ('phy-unitsdim', 'B', 'التحليل البعدي والمتجانسية', 'Dimensional analysis', 'important', '["unit2","unit3","unit5"]', '[2,3,4]', 3, '["sk_units"]', '[R·C]=[T]، وحدتا λ وA، التحليل البعدي لثابت الاحتكاك.', 10),
  ('phy-lawapply', 'B', 'تطبيق علاقة معطاة في موقف بسيط', 'Apply a given relation', 'critical', '["unit1","unit2","unit3","unit4","unit5"]', '[1,2,3]', 3, '["sk_apply_law"]', 'توظيف صحيح: معطى ← تعويض ← حساب دون افتراض معرفة السنة الحالية.', 11),
  ('phy-protocol', 'B', 'الفهم التجريبي (أجهزة وإجراء)', 'Experimental protocol & measurement', 'important', '["unit1","unit3","unit4","unit5"]', '[2,3]', 2, '["sk_protocol"]', 'المعايرة والسّقي، راسم الأمواج، قياس pH والناقلية، التصوير المتعاقب.', 12),
  ('rea-method', 'C', 'المنهجية: استخراج المعطيات وحل المسألة', 'Problem-solving methodology', 'critical', '["unit1","unit2","unit3","unit4","unit5"]', '[1,2,3]', 3, '["sk_calculate","sk_justify"]', 'استخراج المعطيات ← المطلوب ← العلاقة ← التعويض ← التحقق.', 13),
  ('rea-justify', 'C', 'التبرير والاستنتاج المنطقي', 'Justification & logical inference', 'critical', '["unit1","unit2","unit3","unit4","unit5"]', '[2,3,4]', 3, '["sk_justify"]', 'تفسير العوامل الحركية، انحفاظ A وZ، شروط التطور Qr/K، طبيعة الحركة من a·v.', 14),
  ('rea-compare', 'C', 'المقارنة بين كميتين واتخاذ قرار', 'Comparative decisions', 'important', '["unit1","unit2","unit4"]', '[3,5]', 2, '["sk_justify"]', 'مقارنة سرعات عبر t₁/₂، استقرار النوى عبر El/A، قوة الأحماض عبر Ka/pKa.', 15),
  ('rea-modelize', 'C', 'النمذجة: وضعية ← علاقة/معادلة', 'Modeling', 'critical', '["unit1","unit2","unit3","unit4","unit5"]', '[3,5]', 2, '["sk_modelize"]', 'تحويل وضعية إلى معادلة: أكسدة-إرجاع، معادلة تفاضلية، معادلات حركة.', 16)
on conflict (skill_id) do update set
  category = excluded.category,
  title_ar = excluded.title_ar,
  title_en = excluded.title_en,
  importance = excluded.importance,
  prerequisite_for = excluded.prerequisite_for,
  difficulty_levels = excluded.difficulty_levels,
  planned_questions = excluded.planned_questions,
  link_to_taxonomy = excluded.link_to_taxonomy,
  why_prerequisite = excluded.why_prerequisite,
  skill_order = excluded.skill_order;

alter table public.diagnostic_skill_defs enable row level security;
drop policy if exists "Authenticated read skill definitions" on public.diagnostic_skill_defs;
create policy "Authenticated read skill definitions"
  on public.diagnostic_skill_defs for select
  to authenticated
  using (true);
revoke all on public.diagnostic_skill_defs from public;
revoke all on public.diagnostic_skill_defs from anon;
grant select on public.diagnostic_skill_defs to authenticated;

-- ------------------------------------------------------------
-- 3) HELPERS (missing helpers only; the core three are recreated below)
-- ------------------------------------------------------------
create or replace function public.diagnostic_lesson_order(p_unit text)
returns int
language sql
immutable
as $$
  select case p_unit
    when 'unit1' then 1
    when 'unit2' then 2
    when 'unit3' then 3
    when 'unit4' then 4
    when 'unit5' then 5
    else 0
  end;
$$;

create or replace function public.diagnostic_lesson_label(p_unit text)
returns text
language sql
immutable
as $$
  select case p_unit
    when 'unit1' then 'المتابعة الزمنية لتحول كيميائي في وسط مائي'
    when 'unit2' then 'التحويلات النووية'
    when 'unit3' then 'الظواهر الكهربائية (المكثفة والوشيعة)'
    when 'unit4' then 'تطور جملة كيميائية نحو التوازن'
    when 'unit5' then 'تطور جملة ميكانيكية (الميكانيك)'
    else null
  end;
$$;

create or replace function public.diagnostic_importance(p_skill text)
returns text
language sql
stable
as $$
  select importance from public.diagnostic_skill_defs where skill_id = p_skill;
$$;

create or replace function public.diagnostic_dimension_score(p_dim text, p_map jsonb)
returns numeric
language plpgsql
immutable
as $$
declare
  v_skills text[] := '{}'::text[];
  v_skill text;
  v_sum numeric := 0;
  v_n numeric := 0;
  v_score numeric;
begin
  v_skills := case p_dim
    when 'math' then array['mat-num','mat-unitconv','mat-algebra','mat-proportion','mat-logexp','mat-calc','mat-vectrig']
    when 'physics' then array['phy-graph','phy-table','phy-unitsdim','phy-lawapply','phy-protocol']
    when 'scientific' then array['rea-method','rea-justify','rea-compare','rea-modelize']
    when 'num' then array['mat-num']
    when 'units' then array['mat-unitconv','phy-unitsdim']
    when 'proportion' then array['mat-proportion']
    when 'algebra' then array['mat-algebra']
    when 'log_exp' then array['mat-logexp']
    when 'calc' then array['mat-calc']
    when 'vectors' then array['mat-vectrig']
    when 'graph' then array['phy-graph']
    when 'experimental' then array['phy-protocol','phy-table']
    else '{}'::text[]
  end;
  foreach v_skill in array v_skills
  loop
    if p_map ? v_skill then
      v_score := (p_map -> v_skill ->> 'score')::numeric;
      v_sum := v_sum + coalesce(v_score, 0);
      v_n := v_n + 1;
    end if;
  end loop;
  return case when v_n > 0 then round(v_sum / v_n)::numeric else null end;
end;
$$;

-- Core helpers: L5 support (backwards compatible: old 1..4 unchanged)
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
           when 5 then 2.5
           else 1.0
         end;
$$;

create or replace function public.diagnostic_level(p_score numeric)
returns int
language sql
immutable
as $$
  select case
           when p_score >= 88 then 5
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

-- ------------------------------------------------------------
-- 4) SAVE PRIOR-YEAR SCORES (0..20 each; signal only, not scored)
-- ------------------------------------------------------------
create or replace function public.save_prior_year_scores(
  p_attempt_id uuid,
  p_math_score numeric,
  p_physics_score numeric
) returns void
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
  if p_math_score is null or p_math_score < 0 or p_math_score > 20 then
    raise exception 'نقطة الرياضيات للسنة الماضية يجب أن تكون بين 0 و 20';
  end if;
  if p_physics_score is null or p_physics_score < 0 or p_physics_score > 20 then
    raise exception 'نقطة الفيزياء للسنة الماضية يجب أن تكون بين 0 و 20';
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

  update public.diagnostic_attempts
  set prior_math_score = p_math_score,
      prior_physics_score = p_physics_score
  where id = p_attempt_id;
end;
$$;

-- ------------------------------------------------------------
-- 5) build_diagnostic_report: v2 (dimensions + prior scores)
-- ------------------------------------------------------------
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
    'dimensions', coalesce(v_profile.dimensions, '{}'::jsonb),
    'prior_scores', coalesce(v_profile.prior_scores, jsonb_build_object('physics', v_attempt.prior_physics_score, 'math', v_attempt.prior_math_score)),
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
    'dimensions', coalesce(v_profile.dimensions, '{}'::jsonb),
    'prior_scores', coalesce(v_profile.prior_scores, jsonb_build_object('physics', v_attempt.prior_physics_score, 'math', v_attempt.prior_math_score)),
    'strengths', coalesce(v_profile.strengths, '[]'::jsonb),
    'weaknesses', coalesce(v_profile.weaknesses, '[]'::jsonb),
    'critical_weaknesses', coalesce(v_profile.critical_weaknesses, '[]'::jsonb),
    'recommended_start', coalesce(v_profile.recommended_start, 'baccalaureate_exams'),
    'recommended_learning_path', coalesce(v_profile.recommended_learning_path, '[]'::jsonb),
    'student_context', v_context
  );
end;
$$;

-- ------------------------------------------------------------
-- 6) get_student_diagnostic_context: v2 (full skill map passthrough)
-- ------------------------------------------------------------
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
    'dimensions', p.dimensions,
    'prior_scores', p.prior_scores,
    'strengths', p.strengths,
    'weaknesses', p.weaknesses,
    'critical_weaknesses', p.critical_weaknesses,
    'skill_map', p.skill_map,
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

-- ------------------------------------------------------------
-- 7) submit_diagnostic_attempt: v2 scoring + learning path
-- ------------------------------------------------------------
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
  v_def record;
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
  v_map jsonb := '{}'::jsonb;
  v_strengths jsonb := '[]'::jsonb;
  v_weaknesses jsonb := '[]'::jsonb;
  v_critical jsonb := '[]'::jsonb;
  v_rec_start text := 'baccalaureate_exams';
  v_path jsonb := '[]'::jsonb;
  v_dimensions jsonb := '{}'::jsonb;
  v_prior jsonb := '{}'::jsonb;
  v_step jsonb;
  v_lessons jsonb;
  v_lesson text;
  v_lesson_lbl text;
  v_lesson_pos int;
  v_ord int;
  v_crit_pos int := 99;
  v_weak_pos int := 99;
  v_crit_lesson text;
  v_weak_lesson text;
  v_units_order text[] := array['unit1','unit2','unit3','unit4','unit5']::text[];
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

    update public.diagnostic_questions
    set times_used = times_used + 1,
        times_correct = times_correct + case when v_option_id = v_q.correct_option then 1 else 0 end
    where id = v_q.id;
  end loop;

  v_overall := round((v_earned / nullif(v_total_weight, 0)) * 100);
  v_level := public.diagnostic_level(v_overall);

  -- Per-skill diagnosis (driven by whatever skills the test actually uses)
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

    v_map := v_map || jsonb_build_object(v_skill.skill, jsonb_build_object(
      'score', v_score,
      'level', v_level_num,
      'status', v_status,
      'questions_answered', v_skill.q_count,
      'correct_answers', v_skill.c_count,
      'importance', coalesce(public.diagnostic_importance(v_skill.skill), 'important')));

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

  -- ------------------------------------------------------------
  -- Learning path (v2 gating):
  --   critical  => required remediation (إلزامي), earliest affected lesson
  --   weak      => recommended remediation (موصى به)
  --   strength/good => nothing (never blocks curriculum study)
  -- Path order follows pedagogical skill_order (A maths → B physics → C reasoning).
  -- ------------------------------------------------------------
  v_path := '[]'::jsonb;
  v_crit_pos := 99;
  v_weak_pos := 99;

  for v_def in
    select sd.*
    from public.diagnostic_skill_defs sd
    order by sd.skill_order
  loop
    v_status := v_map -> v_def.skill_id ->> 'status';
    if v_status is null or v_status not in ('critical', 'weak') then
      continue;
    end if;

    -- earliest lesson in the curriculum that requires this skill
    v_lessons := coalesce(v_def.prerequisite_for, '[]'::jsonb);
    v_lesson_pos := 99;
    v_lesson_lbl := null;
    for i in 1..jsonb_array_length(v_lessons)
    loop
      v_lesson := v_lessons ->> (i - 1);
      v_ord := public.diagnostic_lesson_order(v_lesson);
      if v_ord > 0 and v_ord < v_lesson_pos then
        v_lesson_pos := v_ord;
        v_lesson_lbl := public.diagnostic_lesson_label(v_lesson);
      end if;
    end loop;

    if v_status = 'critical' and v_lesson_pos < v_crit_pos and v_lesson_pos <= 5 then
      v_crit_pos := v_lesson_pos;
      v_crit_lesson := v_units_order[v_lesson_pos];
    end if;
    if v_status = 'weak' and v_lesson_pos < v_weak_pos and v_lesson_pos <= 5 then
      v_weak_pos := v_lesson_pos;
      v_weak_lesson := v_units_order[v_lesson_pos];
    end if;

    v_step := jsonb_build_object(
      'focus', v_def.skill_id,
      'title', v_def.title_ar,
      'required', (v_status = 'critical'),
      'reason', v_status,
      'description',
        case
          when v_status = 'critical' and v_lesson_lbl is not null
            then 'إلزامي قبل متابعة: ' || v_lesson_lbl || '. ' || coalesce(v_def.why_prerequisite, '')
          when v_status = 'critical'
            then 'إلزامي قبل متابعة الدروس (مهارة حرجة).'
          when v_lesson_lbl is not null
            then 'موصى به لتعزيز التحصيل: ' || v_lesson_lbl || '. ' || coalesce(v_def.why_prerequisite, '')
          else 'موصى به لتعزيز التحصيل.'
        end
    );
    v_path := v_path || jsonb_build_array(v_step);
  end loop;

  if v_crit_pos < 99 then
    v_rec_start := v_crit_lesson;
  elsif v_weak_pos < 99 then
    v_rec_start := v_weak_lesson;
  else
    v_rec_start := 'baccalaureate_exams';
  end if;

  -- Dimension averages (math / physics / scientific + detailed axes)
  v_dimensions := jsonb_build_object(
    'overall', v_overall,
    'level', v_level,
    'math', public.diagnostic_dimension_score('math', v_map),
    'physics', public.diagnostic_dimension_score('physics', v_map),
    'scientific', public.diagnostic_dimension_score('scientific', v_map),
    'num', public.diagnostic_dimension_score('num', v_map),
    'units', public.diagnostic_dimension_score('units', v_map),
    'proportion', public.diagnostic_dimension_score('proportion', v_map),
    'algebra', public.diagnostic_dimension_score('algebra', v_map),
    'log_exp', public.diagnostic_dimension_score('log_exp', v_map),
    'calc', public.diagnostic_dimension_score('calc', v_map),
    'vectors', public.diagnostic_dimension_score('vectors', v_map),
    'graph', public.diagnostic_dimension_score('graph', v_map),
    'experimental', public.diagnostic_dimension_score('experimental', v_map)
  );

  v_prior := jsonb_build_object(
    'physics', v_attempt.prior_physics_score,
    'math', v_attempt.prior_math_score
  );

  update public.diagnostic_attempts
  set status = 'submitted',
      completed_at = now(),
      duration_seconds = coalesce(p_duration_seconds, extract(epoch from (now() - v_attempt.started_at))::int),
      overall_score = v_overall,
      level = v_level
  where id = v_attempt.id;

  insert into public.student_diagnostic_profiles
    (student_id, subject, overall_score, level, strengths, weaknesses, critical_weaknesses,
     recommended_start, recommended_learning_path, skill_map, dimensions, prior_scores,
     assessment_version, last_attempt_id, updated_at)
  values
    (v_uid, v_test.subject, v_overall, v_level, v_strengths, v_weaknesses, v_critical,
     v_rec_start, v_path, v_map, v_dimensions, v_prior,
     v_test.question_bank_version, v_attempt.id, now())
  on conflict (student_id, subject) do update
    set overall_score = excluded.overall_score,
        level = excluded.level,
        strengths = excluded.strengths,
        weaknesses = excluded.weaknesses,
        critical_weaknesses = excluded.critical_weaknesses,
        recommended_start = excluded.recommended_start,
        recommended_learning_path = excluded.recommended_learning_path,
        skill_map = excluded.skill_map,
        dimensions = excluded.dimensions,
        prior_scores = excluded.prior_scores,
        assessment_version = excluded.assessment_version,
        last_attempt_id = excluded.last_attempt_id,
        updated_at = now();

  return public.build_diagnostic_report(v_attempt.id);
end;
$$;

-- ------------------------------------------------------------
-- 8) GRANTS (new/changed objects)
-- ------------------------------------------------------------
revoke all on function public.diagnostic_lesson_order(text) from public;
revoke all on function public.diagnostic_lesson_order(text) from anon;
revoke all on function public.diagnostic_lesson_label(text) from public;
revoke all on function public.diagnostic_lesson_label(text) from anon;
revoke all on function public.diagnostic_importance(text) from public;
revoke all on function public.diagnostic_importance(text) from anon;
revoke all on function public.diagnostic_dimension_score(text, jsonb) from public;
revoke all on function public.diagnostic_dimension_score(text, jsonb) from anon;
revoke all on function public.save_prior_year_scores(uuid, numeric, numeric) from public;
revoke all on function public.save_prior_year_scores(uuid, numeric, numeric) from anon;

grant execute on function public.diagnostic_lesson_order(text) to authenticated;
grant execute on function public.diagnostic_lesson_label(text) to authenticated;
grant execute on function public.diagnostic_importance(text) to authenticated;
grant execute on function public.diagnostic_dimension_score(text, jsonb) to authenticated;
grant execute on function public.save_prior_year_scores(uuid, numeric, numeric) to authenticated;

-- Re-grant the core helpers (create or replace preserves grants, explicit for safety)
revoke all on function public.diagnostic_mult(int) from public;
revoke all on function public.diagnostic_mult(int) from anon;
revoke all on function public.diagnostic_level(numeric) from public;
revoke all on function public.diagnostic_level(numeric) from anon;
revoke all on function public.diagnostic_status(numeric) from public;
revoke all on function public.diagnostic_status(numeric) from anon;
revoke all on function public.build_diagnostic_report(uuid, boolean) from public;
revoke all on function public.build_diagnostic_report(uuid, boolean) from anon;
revoke all on function public.submit_diagnostic_attempt(uuid, int) from public;
revoke all on function public.submit_diagnostic_attempt(uuid, int) from anon;
revoke all on function public.get_student_diagnostic_context() from public;
revoke all on function public.get_student_diagnostic_context() from anon;

grant execute on function public.diagnostic_mult(int) to authenticated;
grant execute on function public.diagnostic_level(numeric) to authenticated;
grant execute on function public.diagnostic_status(numeric) to authenticated;
grant execute on function public.build_diagnostic_report(uuid, boolean) to authenticated;
grant execute on function public.submit_diagnostic_attempt(uuid, int) to authenticated;
grant execute on function public.get_student_diagnostic_context() to authenticated;