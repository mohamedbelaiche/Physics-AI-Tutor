-- 013_skill_profiles_write_policies.sql
-- student_skill_profiles كان له سياسة قراءة فقط (قديمة من نظام التشخيص الذي يكتب عبر
-- SECURITY DEFINER functions). API التعلّم التكيفي الجديد يكتب مباشرة عبر PostgREST
-- لذلك نضيف سياسات INSERT/UPDATE للطالب على ملفاته الخاصة دون فتح أي وصول خارجي.

create policy "Students insert own skill profiles"
  on public.student_skill_profiles for insert
  to authenticated
  with check ((select auth.uid()) = student_id);

create policy "Students update own skill profiles"
  on public.student_skill_profiles for update
  to authenticated
  using ((select auth.uid()) = student_id)
  with check ((select auth.uid()) = student_id);