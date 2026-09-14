-- 017_remove_course.sql
-- إزالة الدورة التعليمية بشكل متكامل: إسقاط كائنات قاعدة البيانات المرتبطة بها.
-- الترتيب: الجداول الأبناء (المرتبطة بمفاتيح أجنبية) قبل الآباء، ثم الدوال.

drop table if exists public.course_exam_answers;
drop table if exists public.course_exam_attempts;
drop table if exists public.course_progress;
drop table if exists public.course_skill_profiles;
drop table if exists public.student_learning_profile;

drop function if exists public.get_student_course_context();