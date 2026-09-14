-- 016_course_exam_attempt_questions.sql
-- يُخزَّن في كل محاولة إمتحان قائمة أسئلة العرض الفعلية حتى تُصحَّح المحاولة ضدها فقط
-- (لا تُقبل أسئلة يختارها العميل، فلا يُضخَّم الإتقان عبر بنك كامل).
alter table public.course_exam_attempts
  add column if not exists question_ids jsonb not null default '[]'::jsonb;
