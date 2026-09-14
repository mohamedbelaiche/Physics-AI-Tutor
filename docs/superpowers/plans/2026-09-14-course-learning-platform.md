# واجهة الدورة التعليمية التتابعية مع التعلّم التكيّفي — خطة التنفيذ

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** إضافة واجهة «الدورة التعليمية» للفيزياء بمسار تتابعي إجباري: وحدات ← دروس ← عناصر، مع إمتحانات QCM (درس/وحدة/نهائي) تحدد نقاط القوة والضعف وتُخزَّن، ومسار تكيّفي يبني الشرح والامتحانات حسب إتقان المهارات.

**Architecture:** واجهة SPA ثانية (تبويب بجانب «الملخصات») تعرض مسار التقدم. المحتوى ثابت في `public/course/*.json` (عرب، RTL). حالة الطالب فقط في Supabase (5 جداول جديدة + RPC). خادم Vercel serverless نمط `api/chat.js`: 4 مسارات `/api/course/*` تُدرّس بواسطة محرك Node نقي (تسلسل/تصحيح/مهارات/توليد امتحان/تكيّف) يفرض التتابع الإجباري من الخادم.

**Tech Stack:** Node.js (بدون إطار)، `@supabase/supabase-js`، SPA أساسية (HTML/JS/CSS)، OpenRouter عبر `fetch`، KaTeX منصوب مسبقاً.

**Spec:** `docs/superpowers/specs/2026-09-13-course-learning-platform-design.md`

## Global Constraints

- اللغة/الاتجاه: عربي RTL؛ لا أسرار جديدة؛ المفتاح OpenRouter الموجود يُستخدم لنقطة التكيّف.
- لا يُطال أي جدول تشخيصي موجود؛ جداول الدورة الجديدة مستقلة ببلى `course_*`.
- المحتوى ثابت (يُبنى بسكربت) وحالة الطالب فقط في قاعدة البيانات.
- عتبات النجاح: درس ≥60%، وحدة ≥50%، النهائي لا يتطلب نجاحاً.
- التتابع الإجباري مفروض من الخادم؛ لا يمكن الدخول لدرس قبل نجاح إمتحان سابقه.
- كل صف في الجداول الجديدة مقصورة على صاحبه بقواعد RLS `auth.uid() = user_id`.
- قرار معتمد: يُعاد استخدام المحتوى المُؤلَّف سابقاً (المحذوف في `c25417b`) من المحفوظات، مع تصنيف المهارات القديم (`dom-*`, `mat-*`, `phy-*`, `rea-*`) بدل `sk_*` — أبسط وأكثر اتساقاً مع الـ43 سؤالاً الموجودة. تصنيف التشخيص (`student_skill_profiles`) يبقى منفصلاً.
- `skills-lock.json` لا يُعدّل. `package.json` يبقى دون إضافات (لا اختبار runner؛ الاختبار عبر سكربتات Node).

---

## ملاحظة إعادة الاستخدام

المحتوى المُؤلَّف سابقاً موجود في git والمحفوظ في مساراته الأصلية قبل الحذف:
- `api/data/course.json` (5 وحدات، 14 درساً، 41 عنصراً)
- `api/data/questions.json` (43 سؤالاً تغطي الوحدتين 1 و5)
- `api/data/skills.json` (تصنيف المهارات)
- `api/engine/*.js` (محركات قديمة — مرجعية فقط، لا نعيد استخدامها كما هي)

السكربت `scripts/build-course-content.js` يحوّل مصادر `content/course/*.json` إلى الصيغ النهائية.

---

### Task 1: استرجاع مصادر المحتوى ومخطط قاعدة البيانات

**Files:**
- Create: `content/course/course.json` (من git)
- Create: `content/course/questions.json` (من git)
- Create: `content/course/skills.json` (من git)
- Create: `supabase/migrations/015_course_schema.sql`
- Modify: `scripts/apply-migrations-api.js` (قاعدة SELECT لـ migrations_log لا تُحذف؛ المخطط أدناه يفعّل RLS)

**Interfaces:**
- Consumes: بنية `api/data/course.json` و`api/data/questions.json` من commit `c25417b~1`.
- Produces: جداول `course_progress`, `course_exam_attempts`, `course_exam_answers`, `course_skill_profiles`, `student_learning_profile` + RPC `get_student_course_context()`؛ وملفات `content/course/*.json` كمدخلات للبناء (Task 2).

- [ ] **Step 1: استرجاع الملفات الثلاثة من git**

Run (PowerShell, من جذر المشروع):
```powershell
mkdir content\course -Force | Out-Null
git show c25417b~1:api/data/course.json | Set-Content -Encoding UTF8 content/course/course.json
git show c25417b~1:api/data/questions.json | Set-Content -Encoding UTF8 content/course/questions.json
git show c25417b~1:api/data/skills.json | Set-Content -Encoding UTF8 content/course/skills.json
node -e "const c=require('./content/course/course.json'); const q=require('./content/course/questions.json'); console.log('ok', c.units.length, q.questions.length)"
```
Expected: `ok 5 43`

- [ ] **Step 2: كتابة migration 015**

أنشئ `supabase/migrations/015_course_schema.sql` بالمحتوى:

```sql
-- 015_course_schema.sql
-- بنية الدورة التعليمية التتابعية + التعلّم التكيّفي (مستقلة عن نظام التشخيص).

-- ===== course_progress: حالة عقدة (عنصر/درس/وحدة/امتحان نهائي) =====
create table if not exists public.course_progress (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  ref_type text not null check (ref_type in ('element','lesson','unit','exam_final')),
  ref_id text not null,
  status text not null default 'locked' check (status in ('locked','in_progress','completed','passed')),
  best_score integer check (best_score between 0 and 100),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, ref_type, ref_id)
);

-- ===== course_exam_attempts: محاولة امتحان (درس/وحدة/نهائي) =====
create table if not exists public.course_exam_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  exam_type text not null check (exam_type in ('lesson','unit','final')),
  ref_id text not null,
  total_questions integer not null,
  correct_count integer not null default 0,
  score integer not null default 0 check (score between 0 and 100),
  passed boolean not null default false,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  duration_sec integer
);

-- ===== course_exam_answers: إجابة كل سؤال في كل محاولة =====
create table if not exists public.course_exam_answers (
  id bigint generated always as identity primary key,
  attempt_id uuid not null references public.course_exam_attempts (id) on delete cascade,
  question_id text not null,
  skill text not null,
  difficulty integer not null,
  selected_index integer,
  is_correct boolean not null default false,
  response_time_sec integer
);

-- ===== course_skill_profiles: إتقان الطالب لكل مهارة على مستوى الدورة =====
create table if not exists public.course_skill_profiles (
  user_id uuid not null references auth.users (id) on delete cascade,
  skill text not null,
  mastery integer not null default 0 check (mastery between 0 and 100),
  n integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, skill)
);

-- ===== student_learning_profile: نبذة الطالب ونقاط القوة/الضعف =====
create table if not exists public.student_learning_profile (
  user_id uuid primary key references auth.users (id) on delete cascade,
  overall_mastery integer not null default 0 check (overall_mastery between 0 and 100),
  overall_level text,
  strengths text[] not null default '{}',
  weaknesses text[] not null default '{}',
  current_position jsonb,
  adaptation_overrides jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- ===== RLS =====
alter table public.course_progress enable row level security;
alter table public.course_exam_attempts enable row level security;
alter table public.course_exam_answers enable row level security;
alter table public.course_skill_profiles enable row level security;
alter table public.student_learning_profile enable row level security;

create policy "Own course_progress select" on public.course_progress for select using (auth.uid() = user_id);
create policy "Own course_progress insert" on public.course_progress for insert with check (auth.uid() = user_id);
create policy "Own course_progress update" on public.course_progress for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Own course_exam_attempts select" on public.course_exam_attempts for select using (auth.uid() = user_id);
create policy "Own course_exam_attempts insert" on public.course_exam_attempts for insert with check (auth.uid() = user_id);
create policy "Own course_exam_attempts update" on public.course_exam_attempts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Own course_exam_answers select" on public.course_exam_answers for select using (
  exists (select 1 from public.course_exam_attempts a where a.id = attempt_id and a.user_id = auth.uid())
);
create policy "Own course_exam_answers insert" on public.course_exam_answers for insert with check (
  exists (select 1 from public.course_exam_attempts a where a.id = attempt_id and a.user_id = auth.uid())
);

create policy "Own course_skill_profiles select" on public.course_skill_profiles for select using (auth.uid() = user_id);
create policy "Own course_skill_profiles insert" on public.course_skill_profiles for insert with check (auth.uid() = user_id);
create policy "Own course_skill_profiles update" on public.course_skill_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Own student_learning_profile select" on public.student_learning_profile for select using (auth.uid() = user_id);
create policy "Own student_learning_profile insert" on public.student_learning_profile for insert with check (auth.uid() = user_id);
create policy "Own student_learning_profile update" on public.student_learning_profile for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ===== updated_at triggers =====
drop trigger if exists set_timestamp_course_progress on public.course_progress;
create trigger set_timestamp_course_progress
  before update on public.course_progress
  for each row execute function public.handle_updated_at();

drop trigger if exists set_timestamp_course_skill_profiles on public.course_skill_profiles;
create trigger set_timestamp_course_skill_profiles
  before update on public.course_skill_profiles
  for each row execute function public.handle_updated_at();

drop trigger if exists set_timestamp_student_learning_profile on public.student_learning_profile;
create trigger set_timestamp_student_learning_profile
  before update on public.student_learning_profile
  for each row execute function public.handle_updated_at();

-- ===== RPC: سياق الدورة للمدرّس الذكي ولنقطة التكيّف =====
create or replace function public.get_student_course_context()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'learning_profile', (select to_jsonb(lp) from public.student_learning_profile lp where lp.user_id = auth.uid()),
    'skill_mastery', (select coalesce(jsonb_object_agg(skill, jsonb_build_object('mastery', mastery, 'n', n)), '{}'::jsonb)
                      from public.course_skill_profiles where user_id = auth.uid()),
    'progress', (select coalesce(jsonb_object_agg(ref_type || ':' || ref_id, jsonb_build_object('status', status, 'best_score', best_score)), '{}'::jsonb)
                 from public.course_progress where user_id = auth.uid())
  );
$$;

-- ===== إصلاح أمني: تفعيل RLS على migrations_log =====
alter table public.migrations_log enable row level security;
drop policy if exists "migrations_log readable by authenticated" on public.migrations_log;
create policy "migrations_log readable by authenticated"
  on public.migrations_log for select
  using (auth.role() = 'authenticated');
```

- [ ] **Step 3: تطبيق وتصفّح**

Run:
```powershell
node scripts/apply-migrations-api.js
```
Expected: `APPLIED: 015_course_schema.sql`

ثم تحقق عبر عميل Supabase (MCP `list_tables`): الجداول الخمسة موجودة و`rls_enabled: true` وأن `migrations_log` أصبح `rls_enabled: true`.

- [ ] **Step 4: Commit**

```bash
git add content/course supabase/migrations/015_course_schema.sql
git commit -m "feat: استرجاع مصادر محتوى الدورة وإضافة مخطط جداول الدورة التعليمية"
```

---

### Task 2: توليد محتوى الدورة (course.json + questions.json + skills.json)

**Files:**
- Create: `scripts/build-course-content.js`
- Create: `scripts/seed-course-questions.js` (الإضافات الجديدة للوحدات 2/3/4 + u5l1s4)
- Create: `content/course/examples.js` (أمثلة مسار لكل درس)
- Create: `public/course/course.json`, `public/course/questions.json`, `public/course/skills.json` (نواتج البناء)
- Create: `scripts/smoke-course.js` (جزء التحقق الصامد للبنية فقط — الإنطلاق الكامل في Task 6)

**Interfaces:**
- Consumes: `content/course/*.json` من Task 1.
- Produces: الملفات الثلاثة النهائية بحيث يكون لكل عنصر (element_id) سؤال واحد على الأقل في `questions.json`، وعن الأصناف الأربعة للخيارات و`correct_index∈[0,3]`، وأمثلة وعناصر course.json وفق الصيغة النهائية:
  - `course.json.units[].lessons[].elements[]`: `{ id, title, order, skills[], key_concepts[], explanation, formulas[], examples[] }`
  - `questions.json.questions[]`: `{ id, unit_id, lesson_id, element_id, skill, difficulty, type, question, options[4], correct_index, explanation }`
  - `skills.json`: كما وردت من المصدر مع `version:1`.

- [ ] **Step 1: سكربت إضافات الأسئلة** — أنشئ `scripts/seed-course-questions.js`:

```js
// seed-course-questions.js — أسئلة QCM مُؤلَّفة للعناصر غير المغطاة (وحدات 2/3/4 + u5l1s4).
// تمتاز هذه الشريحة بالالتزام بمعارف KNOWLEDGE_BASE للوحدات المعنية.
module.exports = [
  // ===== الوحدة الثانية: التحويلات النووية =====
  { id: "q_u2l1s1_1", unit_id: "unit2", lesson_id: "u2l1", element_id: "u2l1s1", skill: "dom-nuclear_eq", difficulty: 1, type: "conceptual",
    question: "في رمز النواة A_ZX، يرمز الحرف Z إلى:",
    options: ["عدد البروتونات (العدد الشحني)", "عدد النيوترونات", "عدد النوى الكلي", "كتلة النواة"],
    correct_index: 0, explanation: "Z هو العدد الشحني = عدد البروتونات، بينما A عدد النوى و N = A − Z عدد النيوترونات." },
  { id: "q_u2l1s1_2", unit_id: "unit2", lesson_id: "u2l1", element_id: "u2l1s1", skill: "dom-nuclear_eq", difficulty: 2, type: "conceptual",
    question: "نواتان لهما نفس Z ومختلفتان في A هما:",
    options: ["نظيران لعنصر كيميائي واحد", "عنصران مختلفان", "نواتان متطابقتان", "جسيمات أولية"],
    correct_index: 0, explanation: "النظائر نواتات نفس العنصر (نفس Z) تختلف في عدد النيوترونات N وبالتالي في A." },

  { id: "q_u2l1s2_1", unit_id: "unit2", lesson_id: "u2l1", element_id: "u2l1s2", skill: "dom-nuclear_eq", difficulty: 2, type: "conceptual",
    question: "في معادلة نووية، قانون انحفاظ الشحنة يعني الحفاظ على:",
    options: ["مجموع الأعداد الشحنية Z", "مجموع أعداد النوى A", "عدد النيوترونات فقط", "كتلة كل نواة"],
    correct_index: 0, explanation: "تنضبط المعادلة بانحفاظ كل من A (عدد النوى) و Z (الشحنة) داخل نوى يتبقى مجموع النوكليونات محفوظاً." },
  { id: "q_u2l1s2_2", unit_id: "unit2", lesson_id: "u2l1", element_id: "u2l1s2", skill: "dom-nuclear_eq", difficulty: 3, type: "conceptual",
    question: "إشعاع ألفا α هو انبعاث:",
    options: ["نواة الهيليوم 4_2He", "إلكترون", "فوتون كهرومغناطيسي", "بروتون حر"],
    correct_index: 0, explanation: "جسيم α هو نواة هيليوم (نواة 4_2He)؛ شعاع β⁻ إلكترون و γ فوتون." },

  { id: "q_u2l2s1_1", unit_id: "unit2", lesson_id: "u2l2", element_id: "u2l2s1", skill: "dom-decay_law", difficulty: 2, type: "formula",
    question: "قانون التناقص الإشعاعي يكتب:",
    options: ["N(t) = N₀·e^(−λt)", "N(t) = N₀·e^(λt)", "N(t) = N₀·(1 − λt)", "N(t) = N₀/t"],
    correct_index: 0, explanation: "يتناقص عدد الأنوية N(t) أسياً وفق N(t) = N₀ e^(−λt) حيث λ ثابت التفكك." },
  { id: "q_u2l2s1_2", unit_id: "unit2", lesson_id: "u2l2", element_id: "u2l2s1", skill: "dom-decay_law", difficulty: 2, type: "conceptual",
    question: "ثابت التفكك λ يمثل:",
    options: ["احتمال تفكك نواة واحدة في وحدة الزمن", "زمن عمر النصف", "عدد النوى الابتدائية", "النشاط الإشعاعي"],
    correct_index: 0, explanation: "λ ثابت مميّز للنواة يعطي احتمال تفكك نواة في ثانية؛ قيمته بالوحدة s⁻¹." },

  { id: "q_u2l2s2_1", unit_id: "unit2", lesson_id: "u2l2", element_id: "u2l2s2", skill: "dom-decay_law", difficulty: 2, type: "formula",
    question: "زمن عمر النصف t₁/₂ يربط مع λ بالعلاقة:",
    options: ["t₁/₂ = ln2/λ", "t₁/₂ = λ·ln2", "t₁/₂ = 1/λ", "t₁/₂ = λ/ln2"],
    correct_index: 0, explanation: "من N(t₁/₂) = N₀/2 نستنتج t₁/₂ = ln2/λ." },
  { id: "q_u2l2s2_2", unit_id: "unit2", lesson_id: "u2l2", element_id: "u2l2s2", skill: "mat-logexp", difficulty: 3, type: "calculation",
    question: "عيّنة كتلتها الابتدائية m₀ = 8 g و t₁/₂ = 6 أيام. الكتلة المتبقية بعد 18 يوماً:",
    options: ["1 g", "2 g", "4 g", "6 g"],
    correct_index: 0, explanation: "18 يوماً = 3 فترات نصف عمر؛ m = m₀/2³ = 8/8 = 1 g." },

  { id: "q_u2l2s3_1", unit_id: "unit2", lesson_id: "u2l2", element_id: "u2l2s3", skill: "dom-activity", difficulty: 2, type: "formula",
    question: "النشاط الإشعاعي لعيّنة يحتوي عدد أنويتها N على:",
    options: ["A = λ·N", "A = N/λ", "A = λ/N", "A = N·ln2"],
    correct_index: 0, explanation: "A(t) = λ·N(t)؛ يقاس بالبيكريل Bq (تفكك/ثانية)." },
  { id: "q_u2l2s3_2", unit_id: "unit2", lesson_id: "u2l2", element_id: "u2l2s3", skill: "dom-activity", difficulty: 2, type: "conceptual",
    question: "وحدة قياس النشاط الإشعاعي في النظام الدولي:",
    options: ["البيكريل Bq", "الفولط V", "النيوتن N", "الأوم Ω"],
    correct_index: 0, explanation: "البيكريل Bq يعادل تفككاً واحداً في الثانية." },

  { id: "q_u2l3s1_1", unit_id: "unit2", lesson_id: "u2l3", element_id: "u2l3s1", skill: "dom-bond_energy", difficulty: 2, type: "formula",
    question: "النقصان الكتلي Δm لنواة A_ZX يعطى بالعلاقة:",
    options: ["Δm = Z·m_p + (A−Z)·m_n − m_noyau", "Δm = m_noyau − Z·m_p", "Δm = A·m_p − m_noyau", "Δm = m_noyau + Z·m_p"],
    correct_index: 0, explanation: "نقارن كتلة مكونات النواة المنفصلة بكتلة النواة: Δm = Z.m_p + (A−Z).m_n − m_noyau." },
  { id: "q_u2l3s1_2", unit_id: "unit2", lesson_id: "u2l3", element_id: "u2l3s1", skill: "dom-bond_energy", difficulty: 3, type: "formula",
    question: "طاقة الربط E_l تُحسب من النقصان الكتلي Δm بالعلاقة:",
    options: ["E_l = Δm·c²", "E_l = Δm/c²", "E_l = Δm·c", "E_l = ½·Δm·c²"],
    correct_index: 0, explanation: "من التكافؤ كتلة-طاقة إنشتاين E_l = Δm.c² (مع Δm بالكغ وc = 3×10⁸ m/s)." },

  { id: "q_u2l3s2_1", unit_id: "unit2", lesson_id: "u2l3", element_id: "u2l3s2", skill: "dom-bond_energy", difficulty: 2, type: "conceptual",
    question: "الانشطار النووي هو:",
    options: ["انشقاق نواة ثقيلة إلى نواتين أخف", "اندماج نواتين خفيفتين", "انبعاث إلكترون من النواة", "تحول تلقائي دون إطلاق طاقة"],
    correct_index: 0, explanation: "الانشطار تفكك نواة ثقيلة (مثل اليورانيوم) بقذيفة نيوترون إلى نواتين خفيفتين مع إطلاق طاقة." },
  { id: "q_u2l3s2_2", unit_id: "unit2", lesson_id: "u2l3", element_id: "u2l3s2", skill: "dom-bond_energy", difficulty: 3, type: "conceptual",
    question: "الاندماج النووي يحرر طاقة مرتفعة لأن:",
    options: ["طاقة الربط لكل نوية للنواتج أكبر منها للمتفاعلات", "كتلة النواتج أكبر", "النواتج أكثر استقراراً من جهة العدد الشحني", "عدد النويات يزداد"],
    correct_index: 0, explanation: "منحنى أستون: النواتج الخفيفة أقرب لقمة الاستقرار، فطاقة الربط لكل نوية أكبر والفرق يتحرر." },

  // ===== الوحدة الثالثة: الظواهر الكهربائية =====
  { id: "q_u3l1s1_1", unit_id: "unit3", lesson_id: "u3l1", element_id: "u3l1s1", skill: "dom-rc_rl", difficulty: 1, type: "formula",
    question: "العلاقة بين شحنة المكثفة وتوترها:",
    options: ["q = C·u", "q = u/C", "q = C/u", "q = C²·u"],
    correct_index: 0, explanation: "شحنة مكثفة سعتها C مشحونة تحت توتر u: q = C.u." },
  { id: "q_u3l1s1_2", unit_id: "unit3", lesson_id: "u3l1", element_id: "u3l1s1", skill: "mat-unitconv", difficulty: 2, type: "conceptual",
    question: "وحدة قياس السعة الكهربائية في النظام الدولي:",
    options: ["الفاراد F", "الأوم Ω", "الهنري H", "الفولط V"],
    correct_index: 0, explanation: "السعة تقاس بالفاراد F = C/V؛ 1µF = 10⁻⁶ F." },

  { id: "q_u3l1s2_1", unit_id: "unit3", lesson_id: "u3l1", element_id: "u3l1s2", skill: "dom-rc_rl", difficulty: 2, type: "conceptual",
    question: "أثناء شحن مكثفة على التوالي مع مُقاومة، التوتر u_C(t):",
    options: ["يتصاعد نحو E بالتحايل (تقاربي)", "يتناقص نحو 0", "يصبح E فوراً", "يتذبذب بلا توقف"],
    correct_index: 0, explanation: "حل المعادلة التفاضلية u_C(t) = E(1 − e^(−t/τ)) يتصاعد تقاربياً نحو E." },
  { id: "q_u3l1s2_2", unit_id: "unit3", lesson_id: "u3l1", element_id: "u3l1s2", skill: "dom-rc_rl", difficulty: 3, type: "formula",
    question: "المعادلة التفاضلية لشحن مكثفة في دارة RC:",
    options: ["RC·du_C/dt + u_C = E", "RC·du_C/dt = E", "u_C = E·t/RC", "RC·du_C/dt + E = 0"],
    correct_index: 0, explanation: "من قانون الملتف: u_R + u_C = E مع u_R = R.i = RC.du_C/dt." },

  { id: "q_u3l1s3_1", unit_id: "unit3", lesson_id: "u3l1", element_id: "u3l1s3", skill: "dom-time_constant", difficulty: 2, type: "formula",
    question: "ثابت الزمن τ لثنائي القطب RC:",
    options: ["τ = R·C", "τ = R/C", "τ = C/R", "τ = 1/(R·C)"],
    correct_index: 0, explanation: "τ = RC بالثانية (R بالأوم وC بالفاراد)." },
  { id: "q_u3l1s3_2", unit_id: "unit3", lesson_id: "u3l1", element_id: "u3l1s3", skill: "phy-graph", difficulty: 2, type: "conceptual",
    question: "عند t = τ أثناء الشحن، تبلغ u_C تقريباً:",
    options: ["63% من E", "50% من E", "100% من E", "0% من E"],
    correct_index: 0, explanation: "u_C(τ) = E(1 − e⁻¹) ≈ 0.63·E." },

  { id: "q_u3l1s4_1", unit_id: "unit3", lesson_id: "u3l1", element_id: "u3l1s4", skill: "dom-energy", difficulty: 2, type: "formula",
    question: "الطاقة المخزنة في مكثفة مشحونة تحت توتر u:",
    options: ["E = ½·C·u²", "E = C·u²", "E = ½·C·u", "E = ½·C²·u"],
    correct_index: 0, explanation: "الطاقة الكهروستاتيكية E = ½.C.u² = q²/(2C)." },
  { id: "q_u3l1s4_2", unit_id: "unit3", lesson_id: "u3l1", element_id: "u3l1s4", skill: "mat-algebra", difficulty: 3, type: "calculation",
    question: "مكثفة سعتها C = 1 µF مشحونة تحت u = 10 V تخزّن طاقة قدرها:",
    options: ["50 µJ", "10 µJ", "5 µJ", "100 µJ"],
    correct_index: 0, explanation: "E = ½×1×10⁻⁶×10² = 50 µJ." },

  { id: "q_u3l2s1_1", unit_id: "unit3", lesson_id: "u3l2", element_id: "u3l2s1", skill: "dom-rc_rl", difficulty: 2, type: "formula",
    question: "التوتر بين طرفي وشيعة حقيقية (مقاومة r ومعامل ذاتي L):",
    options: ["u_AB = r·i + L·di/dt", "u_AB = L·i", "u_AB = r·i − L·di/dt", "u_AB = L·di/dt − r·i"],
    correct_index: 0, explanation: "u_AB = r.i + u_self حيث u_self = L.di/dt توتر المعايرة الذاتية." },
  { id: "q_u3l2s1_2", unit_id: "unit3", lesson_id: "u3l2", element_id: "u3l2s1", skill: "dom-rc_rl", difficulty: 3, type: "conceptual",
    question: "المعايرة الذاتية هي:",
    options: ["ظهور توتر تحريضي بين طرفي الوشيعة عند تغير التيار", "شحن المكثفة بالطاقة", "تبادل حراري في الناقل", "انعدام التوتر في الوشيعة"],
    correct_index: 0, explanation: "كل تغير في التيار يولد توتراً تحريضياً e = −L.di/dt يعاكس سبب تغيره (قاعدة لنز)." },

  { id: "q_u3l2s2_1", unit_id: "unit3", lesson_id: "u3l2", element_id: "u3l2s2", skill: "dom-rc_rl", difficulty: 2, type: "conceptual",
    question: "عند قفل القاطعة في دارة RL، شدة التيار:",
    options: ["تتزايد تصاعدياً نحو I = E/R بالتحايل", "تصل فوراً إلى I = E/R", "تنعدم دائماً", "تنقص نحو 0"],
    correct_index: 0, explanation: "بسبب المعايرة الذاتية يتأسس التيار تدريجياً: i(t) = (E/R)(1 − e^(−t/τ))." },
  { id: "q_u3l2s2_2", unit_id: "unit3", lesson_id: "u3l2", element_id: "u3l2s2", skill: "dom-rc_rl", difficulty: 3, type: "conceptual",
    question: "الفتح المفاجئ لقاطعة في دارة RL (دارة تشمل وشيعة) قد يسبب:",
    options: ["توتراً ذاتياً كبيراً قد يُحدث شرارة", "انعدام التيار فوراً دون أي أثر", "شحن المكثفة", "توقفاً كاملاً للتحريض"],
    correct_index: 0, explanation: "di/dt كبير عند الفتح فينتج توتر ذاتي u = L.di/dt مرتفع قد يسبب شرارة بين طرفي القاطعة." },

  { id: "q_u3l2s3_1", unit_id: "unit3", lesson_id: "u3l2", element_id: "u3l2s3", skill: "dom-time_constant", difficulty: 2, type: "formula",
    question: "ثابت الزمن τ لثنائي القطب RL:",
    options: ["τ = L/R", "τ = L·R", "τ = R/L", "τ = L + R"],
    correct_index: 0, explanation: "τ = L/R (L بالهنري وR بالأوم)." },
  { id: "q_u3l2s3_2", unit_id: "unit3", lesson_id: "u3l2", element_id: "u3l2s3", skill: "dom-energy", difficulty: 2, type: "formula",
    question: "الطاقة المغناطيسية المخزنة في وشيعة يسري فيها تيار i:",
    options: ["E = ½·L·i²", "E = L·i²", "E = ½·L·i", "E = ½·L²·i"],
    correct_index: 0, explanation: "الطاقة المخزنة E = ½.L.i² في حقلها المغناطيسي." },

  // ===== الوحدة الرابعة: التوازن الكيميائي =====
  { id: "q_u4l1s1_1", unit_id: "unit4", lesson_id: "u4l1", element_id: "u4l1s1", skill: "dom-acid_base", difficulty: 1, type: "conceptual",
    question: "الجداء الشاردي للماء Ke عند درجة 25°C:",
    options: ["Ke = 10⁻¹⁴", "Ke = 10⁻⁷", "Ke = 14", "Ke = 0"],
    correct_index: 0, explanation: "Ke = [H₃O⁺]·[OH⁻] = 10⁻¹⁴ عند 25°C." },
  { id: "q_u4l1s1_2", unit_id: "unit4", lesson_id: "u4l1", element_id: "u4l1s1", skill: "mat-logexp", difficulty: 2, type: "calculation",
    question: "pH محلول تركيز الشوارد [H₃O⁺] فيه 10⁻⁵ mol/L:",
    options: ["5", "9", "10⁻⁵", "7"],
    correct_index: 0, explanation: "pH = −log[H₃O⁺] = −log(10⁻⁵) = 5." },

  { id: "q_u4l1s2_1", unit_id: "unit4", lesson_id: "u4l1", element_id: "u4l1s2", skill: "dom-acid_base", difficulty: 2, type: "conceptual",
    question: "الحمض القوي في الماء يتفكك:",
    options: ["تفككاً تاماً", "جزئياً فقط", "بنسبة قليلة جداً", "لا يتفكك أصلاً"],
    correct_index: 0, explanation: "الحمض القوي يتأين تاماً في الماء (معادلة تامة) على عكس الحمض الضعيف." },
  { id: "q_u4l1s2_2", unit_id: "unit4", lesson_id: "u4l1", element_id: "u4l1s2", skill: "rea-compare", difficulty: 3, type: "conceptual",
    question: "لمحلولين من حمضين مختلفين بنفس التركيز C، الحمض الأقوى هو الذي:",
    options: ["له pH أصغر", "له pH أكبر", "له نفس pH", "يتفكك بنسبة أقل"],
    correct_index: 0, explanation: "الحمض الأقوى يعطي [H₃O⁺] أكبر وبالتالي pH أصغر عند نفس C." },

  { id: "q_u4l2s1_1", unit_id: "unit4", lesson_id: "u4l2", element_id: "u4l2s1", skill: "dom-equilibrium", difficulty: 2, type: "conceptual",
    question: "في تفاعل محدود، التقدم النهائي x_f:",
    options: ["أصغر من التقدم الأعظمي x_max", "يساوي x_max دائماً", "أكبر من x_max", "قيمة سالبة"],
    correct_index: 0, explanation: "في التفاعل المحدود يتوقف التفاعل قبل نفاد المتفاعلات المحدِّد فيكون x_f < x_max." },
  { id: "q_u4l2s1_2", unit_id: "unit4", lesson_id: "u4l2", element_id: "u4l2s1", skill: "rea-compare", difficulty: 3, type: "conceptual",
    question: "في تفاعل تام يكون x_f = x_max وبذلك النسبة النهائية للتفاعل τ:",
    options: ["تساوي 1", "تساوي 0", "أصغر من 1", "أكبر من 1"],
    correct_index: 0, explanation: "بما أن التقدم النهائي يبلغ الأعظمي في التفاعل التام، فإن τ = x_f/x_max = 1." },

  { id: "q_u4l2s2_1", unit_id: "unit4", lesson_id: "u4l2", element_id: "u4l2s2", skill: "dom-equilibrium", difficulty: 3, type: "conceptual",
    question: "ثابت التوازن K لتفاعل كيميائي في محلول:",
    options: ["قيمة ثابتة عند درجة حرارة معينة", "يتغير مع إضافة التركيز", "يتغير مع الحجم", "يقاس بالفولط"],
    correct_index: 0, explanation: "K خاصية مميزة للتفاعل عند درجة حرارة محددة ولا تعتمد على التراكيز الابتدائية." },
  { id: "q_u4l2s2_2", unit_id: "unit4", lesson_id: "u4l2", element_id: "u4l2s2", skill: "mat-proportion", difficulty: 3, type: "conceptual",
    question: "إن كان حاصل التفاعل Q_r أصغر من ثابت التوازن K فإن التفاعل:",
    options: ["يتقدم في الاتجاه المباشر", "يتقدم في الاتجاه العكسي", "في حالة توازن", "لا يحدث إطلاقاً"],
    correct_index: 0, explanation: "بمقارنة Q_r وK: إن كان Q_r < K يتنقص Q_r (يتقدم مباشراً) حتى يبلغ K عند التوازن." },

  { id: "q_u4l2s3_1", unit_id: "unit4", lesson_id: "u4l2", element_id: "u4l2s3", skill: "dom-equilibrium", difficulty: 2, type: "formula",
    question: "النسبة النهائية للتفاعل τ تعرف بالعلاقة:",
    options: ["τ = x_f/x_max", "τ = x_max/x_f", "τ = x_f − x_max", "τ = x_f·x_max"],
    correct_index: 0, explanation: "τ = x_f/x_max مقياس مردود التفاعل (بين 0 و1)." },
  { id: "q_u4l2s3_2", unit_id: "unit4", lesson_id: "u4l2", element_id: "u4l2s3", skill: "rea-justify", difficulty: 3, type: "conceptual",
    question: "لتحديد الأفراد المسيطرة في الحالة النهائية نعتمد على:",
    options: ["قيمة النسبة النهائية τ مقارنة مع 1", "الكتلة الذرية للعناصر", "السالبية الكهربية", "حجم النواة"],
    correct_index: 0, explanation: "كلما اقتربت τ من 1 سادت النواتج؛ وكلما انخفضت سادت المتفاعلات المتبقية." },

  // ===== الوحدة الخامسة: عنصر غير مغطى =====
  { id: "q_u5l1s4_1", unit_id: "unit5", lesson_id: "u5l1", element_id: "u5l1s4", skill: "phy-graph", difficulty: 3, type: "conceptual",
    question: "في معلم فريني، المركبة المماسية للتسارع a_T:",
    options: ["تُفسّر تغيّر قيمة السرعة", "تُفسّر تغيّر جهة السرعة", "تنعدم في كل الحركات", "تقاس بالمتر"],
    correct_index: 0, explanation: "a_T = dv/dt خاصة بتغير قيمة السرعة، بينما a_N (الناظمية) بتغير الجهة." },
  { id: "q_u5l1s4_2", unit_id: "unit5", lesson_id: "u5l1", element_id: "u5l1s4", skill: "mat-calc", difficulty: 3, type: "conceptual",
    question: "في الحركة الدائرية المنتظمة (v ثابتة):",
    options: ["a_T = 0 بينما a_N ≠ 0", "a_T ≠ 0 بينما a_N = 0", "التسارع منعدم كلياً", "المركبتان معاً منعدمتين"],
    correct_index: 0, explanation: "السرعة ثابتة القيمة (a_T = 0) لكنها متغيرة الجهة فتوجد تسارع ناظمي، والتسارع الكلي ناظمي." }
];
```

- [ ] **Step 2: سكربت أمثلة الدروس** — أنشئ `content/course/examples.js`:

```js
// examples.js — أمثلة مسار لكل درس (تظهر داخل عناصر الدرس).
module.exports = {
  u1l1: [{ title: "مثال 1", body: "الثنائية Cu²⁺/Cu: Cu²⁺ مؤكسد (يكتسب إلكترونين) وCu مرجع (يفقد إلكترونين). اكتب نصفَيّ المعادلتين ثم اجمعها: Cu²⁺ + 2e⁻ ⇌ Cu." }],
  u1l2: [{ title: "مثال 2", body: "حسب x_max لكل متفاعل من n₀(A)/a و n₀(B)/b، والقيمة الصغرى تحدد المتفاعل المحدِّد وتُبنى عليه الحصيلة المولية النهائية." }],
  u1l3: [{ title: "مثال 3", body: "يُتعقب التحول بقياس الناقلية G وقتياً؛ من منحنى σ(t) أو G(t) نستخرج السرعة الحجمية ومن ثم t₁/₂ حيت تبلغ x(t₁/₂) = x_max/2." }],
  u2l1: [{ title: "مثال 4", body: "في تفكك الراديوم 226_88Ra يُصدر نواة 4_2He وتصبح 222_86Rn: نلاحظ انحفاظ A (226 = 222 + 4) و Z (88 = 86 + 2)." }],
  u2l2: [{ title: "مثال 5", body: "عيّنة الكربون 14 kتلتها m₀؛ بعد مرور t₁/₂ تنقص إلى النصف. للتأريخ نعيّن نسبة 14C المتبقية ونطبق N(t) = N₀ e^(−λt) للحصول على t." }],
  u2l3: [{ title: "مثال 6", body: "لنواة الهيليوم Δm = 0.030376u، فـ E_l = Δm.c² ≈ 28.3MeV وطاقة الربط لكل نوية ≈ 7.07MeV — مقياس استقرار النواة." }],
  u3l1: [{ title: "مثال 7", body: "دارة RC بـ R = 10kΩ و C = 100µF: τ = R.C = 1s؛ عند t = 1s تبلغ u_C حوالي 63% من E، وعند t = 5τ تكتمل الشحنة عملياً." }],
  u3l2: [{ title: "مثال 8", body: "دارة RL بـ R = 10Ω و L = 1H: τ = L/R = 0.1s وتيار أقصى I = E/R. عند فتح القاطعة يختفي التيار تدريجياً بنظام أسّي." }],
  u4l1: [{ title: "مثال 9", body: "محلول حمض قوي تركيزه C = 10⁻² mol/L: pH = −log C = 2 (لأن [H₃O⁺] = C بالكامل) — على عكس الحمض الضعيف." }],
  u4l2: [{ title: "مثال 10", body: "تفاعل محدود: من المعايرة نجد x_f، ومن الحساب الستوكيومتري x_max؛ τ = x_f/x_max يعطي نسبة المردود ويحدد الأفراد المسيطرة." }],
  u5l1: [{ title: "مثال 11", body: "في معلم كارتيزي، إذا كانت a·v > 0 فالحركة متسارعة، وإن كانت a·v < 0 فهي متراخية. في معلم فريني a = a_T.n + a_N.u." }],
  u5l2: [{ title: "مثال 12", body: "عندما تكون القوى محافظة فقط نطبق حفظ الطاقة الميكانيكية؛ وإلا نطبّق القانون الثاني لنيوتن ΣF = m.a ثم نكمل بالبرمجة." }],
  u5l3: [{ title: "مثال 13", body: "قمر اصطناعي في مدار دائري: القانون الثالث لكبلر إنطلاقاً من الجاذبية يربط T² بـ r³؛ من انحفاظ الطاقة نحسب السرعة المدارية v = √(GM/r)." }],
  u5l4: [{ title: "مثال 14", body: "السقوط الحر: v = √(2gh) و h = ½gt². للقذيفة: نستخرج بعد الإسقاط على المحورين x = v₀.cosα.t و y = v₀.sinα.t − ½gt²." }]
};
```

- [ ] **Step 3: سكربت البناء** — أنشئ `scripts/build-course-content.js`:

```js
// build-course-content.js — يبني public/course/*.json من sources (content/course/*) وأمثلة الدروس.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const src = (f) => path.join(ROOT, 'content', 'course', f);
const out = (f) => path.join(ROOT, 'public', 'course', f);
const lessonExamples = require(path.join(ROOT, 'content', 'course', 'examples.js'));
const seedQuestions = require(path.join(ROOT, 'scripts', 'seed-course-questions.js'));

function buildCourse() {
  const raw = JSON.parse(fs.readFileSync(src('course.json'), 'utf8'));
  const course = { version: 1, title: raw.title, units: [] };
  raw.units.forEach((u, ui) => {
    const unit = {
      id: u.id, title: u.title, description: u.description, order: ui + 1,
      summary_pdf: u.summary_pdf, exercises_pdf: u.exercises_pdf, lessons: []
    };
    u.lessons.forEach((l, li) => {
      const lesson = {
        id: l.id, title: l.title, order: li + 1, source: l.source,
        skills: l.skills || [], examples: lessonExamples[l.id] || [], elements: []
      };
      (l.sections || []).forEach((s, si) => {
        lesson.elements.push({
          id: s.id, title: s.title, order: si + 1,
          skills: s.skills || [], key_concepts: s.key_concepts || [],
          explanation: s.explanation || '', formulas: [], examples: []
        });
      });
      unit.lessons.push(lesson);
    });
    course.units.push(unit);
  });
  return course;
}

function buildQuestions(course) {
  const old = JSON.parse(fs.readFileSync(src('questions.json'), 'utf8'));
  const byId = new Map();
  course.units.forEach((u) => u.lessons.forEach((l) => l.elements.forEach((e) => {
    if (!byId.has(e.id)) byId.set(e.id, { id: e.id, unit_id: u.id, lesson_id: l.id });
  })));
  const norm = (q) => ({
    id: q.id, unit_id: q.unit_id, lesson_id: q.lesson_id, element_id: q.element_id || q.section_id,
    skill: q.skill || q.skill_id, difficulty: q.difficulty || 1, type: q.type || 'conceptual',
    question: q.question, options: q.options || q.choices, correct_index: q.correct_index,
    explanation: q.explanation || ''
  });
  const questions = old.questions.map(norm);
  seedQuestions.forEach((q) => questions.push(norm(q)));
  const seen = new Set();
  const deduped = questions.filter((q) => (seen.has(q.id) ? false : (seen.add(q.id), true)));
  return { version: 1, questions: deduped };
}

function buildSkills() {
  const raw = JSON.parse(fs.readFileSync(src('skills.json'), 'utf8'));
  return { version: 1, categories: raw.categories, skills: raw.skills };
}

function main() {
  fs.mkdirSync(out(''), { recursive: true });
  const course = buildCourse();
  const questionsBank = buildQuestions(course);
  fs.writeFileSync(out('course.json'), JSON.stringify(course, null, 2), 'utf8');
  fs.writeFileSync(out('questions.json'), JSON.stringify(questionsBank, null, 2), 'utf8');
  fs.writeFileSync(out('skills.json'), JSON.stringify(buildSkills(), null, 2), 'utf8');
  console.log('built', course.units.length, 'units;', questionsBank.questions.length, 'questions');
}

main();
```

- [ ] **Step 4: تشغيل البناء والتحقق من التغطية**

Run:
```powershell
node scripts/build-course-content.js
```
Expected: `built 5 units; 83 questions`

ثم تحقق يدوياً من اكتمال التغطية (كل عنصر له سؤال واحد على الأقل):
```powershell
node -e "const c=require('./public/course/course.json'); const q=require('./public/course/questions.json'); const m=new Map(); q.questions.forEach(x=>m.set(x.element_id,(m.get(x.element_id)||0)+1)); let miss=[]; c.units.forEach(u=>u.lessons.forEach(l=>l.elements.forEach(e=>{ if(!m.has(e.id)) miss.push(e.id); }))); console.log('uncovered elements:', miss.length===0?'none':miss.join(','));"
```
Expected: `uncovered elements: none`

- [ ] **Step 5: Commit**

```bash
git add scripts/build-course-content.js scripts/seed-course-questions.js content/course/examples.js public/course
git commit -m "feat: توليد محتوى الدورة التعليمية (course/questions/skills) بأمثلة وأسئلة مغطاة"
```

---

### Task 3: محرك الدورة (بيانات + تسلسل + مهارات + توليد امتحان + تصحيح)

**Files:**
- Create: `api/course/engine/data.js`
- Create: `api/course/engine/sequence.js`
- Create: `api/course/engine/skills.js`
- Create: `api/course/engine/exam-gen.js`
- Create: `api/course/engine/scoring.js`
- Create: `scripts/test-engine.js`

**Interfaces:**
- Consumes: `public/course/course.json`, `public/course/questions.json`, `public/course/skills.json` من Task 2.
- Produces (توقيعات صريحة تُستخدم في Task 4):
  - `data.js`: `getCourse()`, `getQuestionBank()`, `getElementsByLesson(lessonId)`, `getLessonsByUnit(unitId)`, `getUnitById(id)`, `getLessonById(id)`, `getElementById(id)`, `questionById(id)`, `questionsForElement(elementId)`, `questionsForLesson(lessonId)`, `questionsForUnit(unitId)`, `allQuestions()`
  - `sequence.js`: `examThreshold(type)` → 60/50؛ `computeSnapshot(course, progressList)` → `{ statuses: Map, lessonsOfUnit, units: [...] }` (انظر الأسفل)؛ `isElementOpen(snapshot, elementId)`, `isExamAvailable(snapshot, type, refId)`
  - `skills.js`: `updateSkill(prev, attemptSkillScore, nAttempt)` → `{mastery, n}`؛ `classifySkills(skillMap)` → `{strengths, weaknesses}`؛ `overallMastery(skillMap)` → int؛ `levelLabel(mastery)` → string
  - `exam-gen.js`: `generateExam(course, bank, type, refId, masteryMap)` → `[{id, unit_id, lesson_id, element_id, skill, difficulty, question, options}]` (لا تتضمن correct_index)
  - `scoring.js`: `gradeAttempt(bank, questions, answers, type, refId)` → `{ correct_count, total, score, passed, per_skill: {skill:{correct,total,score}}, skill_updates: {skill:{attemptScore,n}} }`

- [ ] **Step 1: data.js** — أنشئ `api/course/engine/data.js`:

```js
// data.js — تحميل وقراءة محتوى الدورة الثابت (ملفات public/course/*.json).
const fs = require('fs');
const path = require('path');

const COURSE_DIR = path.join(__dirname, '..', '..', '..', 'public', 'course');
let _course = null;
let _bank = null;

function loadJSON(name) {
  return JSON.parse(fs.readFileSync(path.join(COURSE_DIR, name), 'utf8'));
}

function getCourse() {
  if (!_course) _course = loadJSON('course.json');
  return _course;
}

function getQuestionBank() {
  if (!_bank) _bank = loadJSON('questions.json');
  return _bank;
}

function getUnitById(id) {
  return getCourse().units.find((u) => u.id === id) || null;
}

function getLessonById(id) {
  for (const u of getCourse().units) {
    const l = (u.lessons || []).find((x) => x.id === id);
    if (l) return l;
  }
  return null;
}

function getElementById(id) {
  for (const u of getCourse().units) {
    for (const l of u.lessons || []) {
      const e = (l.elements || []).find((x) => x.id === id);
      if (e) return e;
    }
  }
  return null;
}

function getElementsByLesson(lessonId) {
  const l = getLessonById(lessonId);
  return (l && l.elements) || [];
}

function getLessonsByUnit(unitId) {
  const u = getUnitById(unitId);
  return (u && u.lessons) || [];
}

function questionById(id) {
  return getQuestionBank().questions.find((q) => q.id === id) || null;
}

function questionsForElement(elementId) {
  return getQuestionBank().questions.filter((q) => q.element_id === elementId);
}

function questionsForLesson(lessonId) {
  return getQuestionBank().questions.filter((q) => q.lesson_id === lessonId);
}

function questionsForUnit(unitId) {
  return getQuestionBank().questions.filter((q) => q.unit_id === unitId);
}

function allQuestions() {
  return getQuestionBank().questions;
}

module.exports = {
  getCourse, getQuestionBank, getUnitById, getLessonById, getElementById,
  getElementsByLesson, getLessonsByUnit, questionById,
  questionsForElement, questionsForLesson, questionsForUnit, allQuestions
};
```

- [ ] **Step 2: sequence.js** — أنشئ `api/course/engine/sequence.js`:

```js
// sequence.js — التتابع الإجباري وحساب حالة كل عقدة من حالة الطالب.
// قواعد (المواصفة قسم 6):
//   - لا يُفتح عنصر إلا بعد إتمام الذي قبله (داخل نفس الدرس).
//   - أول عنصر من درس يُفتح بعد نجاح إمتحان الدرس السابق (أو للدرس الأول من الوحدة الأولى).
//   - «إمتحان الدرس» متاح بعد إتمام كل عناصر الدرس؛ الدرس التالي بعد نجاحه.
//   - «إختبار الوحدة» متاح بعد نجاح كل دروسها؛ الوحدة التالية بعد نجاحه.
//   - «الإمتحان الشامل» متاح بعد نجاح إختبارات الوحدات الخمس.
// الحالة لكل نوع: content node -> locked|open|completed | lesson/unit -> locked|open|exam_ready|passed

function examThreshold(type) {
  if (type === 'lesson') return 60;
  if (type === 'unit') return 50;
  return 60;
}

// progressList: [{ ref_type, ref_id, status, best_score }]
function asMap(progressList) {
  const m = new Map();
  (progressList || []).forEach((p) => m.set(p.ref_type + ':' + p.ref_id, p));
  return m;
}

function computeSnapshot(course, progressList) {
  const rows = asMap(progressList);
  const statuses = new Map(); // 'element:ID' | 'lesson:ID' | 'unit:ID'
  const units = course.units.map((u, ui) => {
    const prevUnit = course.units[ui - 1];
    const unitPassed = rows.get('unit:' + u.id) && rows.get('unit:' + u.id).status === 'passed';
    const lessons = u.lessons.map((l, li) => {
      const prevLesson = ui === 0 ? (u.lessons[li - 1] || null) : null; // داخل الوحدة الأولى فقط يُسلسل الدرس بداخلها
      const lessonPassed = rows.get('lesson:' + l.id) && rows.get('lesson:' + l.id).status === 'passed';
      const elements = l.elements.map((e, ei) => {
        const done = rows.get('element:' + e.id) && rows.get('element:' + e.id).status === 'completed';
        return { id: e.id, title: e.title, order: ei + 1, status: done ? 'completed' : 'unknown' };
      });
      return { id: l.id, title: l.title, order: li + 1, lessonPassed, elements };
    });
    return { id: u.id, title: u.title, order: ui + 1, unitPassed, lessons };
  });

  // Pass 1: عناصر الوحدة الأولى والدرس الأول.
  const firstUnit = units[0];
  if (firstUnit) {
    const firstLesson = firstUnit.lessons[0];
    if (firstLesson && firstLesson.elements[0]) {
      statuses.set('element:' + firstLesson.elements[0].id, 'open');
    }
  }

  for (const unit of units) {
    for (const lesson of unit.lessons) {
      for (const e of lesson.elements) {
        const blockKey = 'element:' + e.id;
        if (statuses.has(blockKey)) continue;
        const idx = lesson.elements.findIndex((x) => x.id === e.id);
        const prev = lesson.elements[idx - 1];
        const isFirst = idx === 0;
        const prevDone = prev && rows.get('element:' + prev.id) && rows.get('element:' + prev.id).status === 'completed';
        const prevLesson = unit.lessons[unit.lessons.findIndex((x) => x.id === lesson.id) - 1];
        const prevLessonPassed = prevLesson && rows.get('lesson:' + prevLesson.id) && rows.get('lesson:' + prevLesson.id).status === 'passed';
        const unitPrev = units[units.findIndex((x) => x.id === unit.id) - 1];
        const unitPrevPassed = unitPrev && rows.get('unit:' + unitPrev.id) && rows.get('unit:' + unitPrev.id).status === 'passed';
        if (isFirst) {
          if (prevLessonPassed) statuses.set(blockKey, 'open');
          else if (unitPrevPassed && prevLessonPassed === undefined) statuses.set(blockKey, 'open');
          else if (unit.prev && unitPrevPassed) statuses.set(blockKey, 'open');
          else statuses.set(blockKey, 'locked');
        } else if (prevDone) {
          statuses.set(blockKey, 'open');
        } else {
          statuses.set(blockKey, 'locked');
        }
      }
    }
  }
  // لتسلسل الوحدات: أول عنصر من أول درس في وحدة سابقة ناجحة مفتوح (عبر شرط أعلاه).
  for (const unit of units) {
    if (unit === units[0]) continue;
    const prevUnitObj = units[units.indexOf(unit) - 1];
    const prevUnitPassed = rows.get('unit:' + prevUnitObj.id) && rows.get('unit:' + prevUnitObj.id).status === 'passed';
    if (prevUnitPassed) {
      const firstEl = unit.lessons[0] && unit.lessons[0].elements[0];
      if (firstEl) statuses.set('element:' + firstEl.id, 'open');
    }
  }

  // Pass 2: حالة الدروس والوحدات والامتحانات.
  const unitsOut = [];
  for (const u of course.units) {
    const unitRow = rows.get('unit:' + u.id);
    const unitPassed = !!(unitRow && unitRow.status === 'passed');
    const lessonsOut = u.lessons.map((l) => {
      const lessonRow = rows.get('lesson:' + l.id);
      const lessonPassed = !!(lessonRow && lessonRow.status === 'passed');
      const allElementsDone = l.elements.every((e) => {
        const r = rows.get('element:' + e.id);
        return r && r.status === 'completed';
      });
      let lessonStatus = 'locked';
      if (lessonPassed) lessonStatus = 'passed';
      else if (allElementsDone) lessonStatus = 'exam_ready';
      else if (statuses.get('element:' + (l.elements[0] || {}).id) === 'open') lessonStatus = 'open';
      return {
        id: l.id, title: l.title, order: l.order, status: lessonStatus,
        best_score: lessonRow && Number.isFinite(lessonRow.best_score) ? lessonRow.best_score : null,
        exam: { status: (allElementsDone ? 'available' : 'locked') },
        elements: l.elements.map((e) => ({ id: e.id, title: e.title, order: e.order, status: statuses.get('element:' + e.id) || 'locked' }))
      };
    });
    const allLessonsPassed = lessonsOut.every((ls) => ls.status === 'passed');
    let unitStatus = 'locked';
    if (unitPassed) unitStatus = 'passed';
    else if (u.id === course.units[0].id && lessonsOut[0] && (lessonsOut[0].status === 'open')) unitStatus = 'open';
    else if (allLessonsPassed) unitStatus = 'exam_ready';
    else {
      const prevUnitObj = course.units[course.units.indexOf(u) - 1];
      const prevPassed = prevUnitObj && rows.get('unit:' + prevUnitObj.id) && rows.get('unit:' + prevUnitObj.id).status === 'passed';
      if (prevPassed) unitStatus = 'open';
    }
    unitsOut.push({
      id: u.id, title: u.title, order: u.order, status: unitStatus,
      best_score: unitRow && Number.isFinite(unitRow.best_score) ? unitRow.best_score : null,
      lessons: lessonsOut,
      unit_exam: { status: allLessonsPassed ? 'available' : 'locked' }
    });
  }

  const allUnitsPassed = unitsOut.every((u) => u.status === 'passed' || (u.unit_exam.status === 'available'));
  const finalExam = { status: allUnitsPassed ? 'available' : 'locked' };

  // current_position: أول عنصر مفتوح غير مكتمل بعد.
  let current = null;
  outer:
  for (const u of course.units) {
    for (const l of u.lessons) {
      for (const e of l.elements) {
        const st = statuses.get('element:' + e.id);
        if (st === 'open') { current = { unit_id: u.id, lesson_id: l.id, element_id: e.id }; break outer; }
      }
    }
  }

  return { statuses, units: unitsOut, final_exam: finalExam, current_position: current };
}

function isElementOpen(snapshot, elementId) {
  return snapshot.statuses.get('element:' + elementId) === 'open';
}

function isExamAvailable(snapshot, type, refId) {
  if (type === 'lesson') {
    const u = snapshot.units.find((x) => x.lessons.some((l) => l.id === refId));
    const l = u && u.lessons.find((x) => x.id === refId);
    return !!(l && l.exam.status === 'available');
  }
  if (type === 'unit') {
    const u = snapshot.units.find((x) => x.id === refId);
    return !!(u && u.unit_exam.status === 'available');
  }
  if (type === 'final') return snapshot.final_exam.status === 'available';
  return false;
}

module.exports = { examThreshold, computeSnapshot, isElementOpen, isExamAvailable };
```

- [ ] **Step 3: skills.js** — أنشئ `api/course/engine/skills.js`:

```js
// skills.js — تحديث إتقان المهارات وتصنيف القوة/الضعف والمستوى العام.
// معادلة المواصفة (قسم 8): mastery_جديد = coefficient×درجة_المحاولة + (1−coef)×mastery_سابق،
// مع تضاؤل أثر المحاولة كلما ازدادت العيّنات.

const STRENGTH_AT = 70;
const WEAKNESS_BELOW = 50;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// prev: {mastery, n} | null — attemptSkillScore: 0..100 — nAttempt: عدد أسئلة المهارة في هذه المحاولة
function updateSkill(prev, attemptSkillScore, nAttempt) {
  const prevN = (prev && prev.n) || 0;
  const prevMastery = (prev && Number.isFinite(prev.mastery)) ? prev.mastery : 0;
  const b = clamp(0.6 / Math.sqrt(prevN + 1), 0.2, 0.6);
  const mastery = Math.round(b * attemptSkillScore + (1 - b) * prevMastery);
  return { mastery, n: prevN + nAttempt };
}

function classifySkills(skillMap) {
  const strengths = [];
  const weaknesses = [];
  for (const skill of Object.keys(skillMap)) {
    const p = skillMap[skill];
    if (!p || p.n === 0 || !Number.isFinite(p.mastery)) continue;
    if (p.mastery >= STRENGTH_AT) strengths.push(skill);
    else if (p.mastery < WEAKNESS_BELOW) weaknesses.push(skill);
  }
  return { strengths, weaknesses };
}

function overallMastery(skillMap) {
  const vals = Object.keys(skillMap)
    .map((s) => skillMap[s])
    .filter((p) => p && p.n > 0 && Number.isFinite(p.mastery));
  if (!vals.length) return 0;
  return Math.round(vals.reduce((sum, p) => sum + p.mastery, 0) / vals.length);
}

function levelLabel(mastery) {
  if (mastery >= 85) return 'ممتاز';
  if (mastery >= 70) return 'متقدم';
  if (mastery >= 50) return 'جيّد';
  if (mastery >= 30) return 'متوسط';
  return 'مبتدئ';
}

module.exports = { updateSkill, classifySkills, overallMastery, levelLabel, STRENGTH_AT, WEAKNESS_BELOW };
```

- [ ] **Step 4: exam-gen.js** — أنشئ `api/course/engine/exam-gen.js`:

```js
// exam-gen.js — توليد امتحانات QCM مع ضمان تغطية الأصناف وتدرّج الصعوبة حسب الإتقان.
// أحجام المواصفة (قسم 7): درس 5-8، وحدة 10-15، نهائي 20-30.
// المهارة الضعيفة (<70) تأخذ الأسئلة الأسهل أولاً (1→5)؛ المتقنة (>=70) تأخذ الأصعب (5→1).

const data = require('./data');

function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

function pickOne(arr) {
  return arr[Math.floor(Math.random() * arr.length)] || null;
}

function priorityScore(q, masteryMap) {
  const m = (masteryMap[q.skill] && masteryMap[q.skill].mastery) || 0;
  // الضعيف: الأسهل أولاً (صعوبة صغيرة = أولوية أعلى)؛ المتقن: الأصعب أولاً.
  return m >= 70 ? (6 - q.difficulty) : q.difficulty;
}

function fill(pool, usedIds, target) {
  const result = [];
  const remaining = pool.filter((q) => !usedIds.has(q.id)).sort((a, b) => priorityScore(a, {}) - priorityScore(b, {}));
  for (const q of remaining) {
    if (result.length >= target) break;
    if (usedIds.has(q.id)) continue;
    usedIds.add(q.id);
    result.push(q);
  }
  return result;
}

// type: lesson|unit|final — refId: lesson id / unit id / 'final'
function generateExam(course, bank, type, refId, masteryMap) {
  masteryMap = masteryMap || {};
  const used = new Set();
  const picked = [];

  if (type === 'lesson') {
    const elements = data.getElementsByLesson(refId);
    for (const e of elements) {
      const pool = data.questionsForElement(e.id).slice().sort((a, b) => priorityScore(a, masteryMap) - priorityScore(b, masteryMap));
      const q = pickOne(pool);
      if (q && !used.has(q.id)) { used.add(q.id); picked.push(q); }
    }
    while (picked.length < 8) {
      const extra = fill(data.questionsForLesson(refId), used, 8 - picked.length);
      picked.push(...extra);
      break;
    }
  } else if (type === 'unit') {
    const lessons = data.getLessonsByUnit(refId);
    for (const l of lessons) {
      const pool = data.questionsForLesson(l.id);
      if (pool.length) {
        const sorted = pool.slice().sort((a, b) => priorityScore(a, masteryMap) - priorityScore(b, masteryMap));
        pickUnused(sorted, used, picked);
      }
    }
    while (picked.length < 15) {
      const extra = fill(data.questionsForUnit(refId), used, 15 - picked.length);
      picked.push(...extra);
      break;
    }
  } else { // final
    for (const u of course.units) {
      const pool = data.questionsForUnit(u.id);
      if (pool.length) {
        const sorted = pool.slice().sort((a, b) => priorityScore(a, masteryMap) - priorityScore(b, masteryMap));
        pickUnused(sorted, used, picked);
      }
    }
    while (picked.length < 30) {
      const all = data.allQuestions();
      picked.push(...fill(all, used, 30 - picked.length));
      break;
    }
  }

  const maxSize = type === 'lesson' ? 8 : type === 'unit' ? 15 : 30;
  if (picked.length > maxSize) picked.length = maxSize;

  // لا تُرسل الإجابة الصحيحة ولا الشرح.
  return picked.map((q) => ({
    id: q.id, unit_id: q.unit_id, lesson_id: q.lesson_id, element_id: q.element_id,
    skill: q.skill, difficulty: q.difficulty, question: q.question, options: q.options
  }));
}

function pickUnused(sortedPool, used, picked) {
  for (const q of sortedPool) {
    if (!used.has(q.id)) { used.add(q.id); picked.push(q); break; }
  }
}

module.exports = { generateExam };
```

- [ ] **Step 5: scoring.js** — أنشئ `api/course/engine/scoring.js`:

```js
// scoring.js — تصحيح محاولة امتحان وفق correct_index، حساب درجة كل مهارة وفحص النجاح.
const { examThreshold } = require('./sequence');

// questions: مصفوفة أسئلة الامتحان المُرسَل (بالميتاداتا فقط). answers: [{question_id, selected_index}]
function gradeAttempt(bank, questions, answers, type) {
  const byId = new Map(bank.questions.map((q) => [q.id, q]));
  const perSkill = {};
  let correctCount = 0;

  for (const item of questions) {
    const q = byId.get(item.id);
    if (!q) continue;
    const ans = (answers || []).find((a) => a.question_id === item.id);
    const correct = ans && ans.selected_index === q.correct_index;
    if (correct) correctCount++;
    if (!perSkill[q.skill]) perSkill[q.skill] = { correct: 0, total: 0 };
    perSkill[q.skill].total += 1;
    if (correct) perSkill[q.skill].correct += 1;
  }

  const total = questions.length || 1;
  const score = Math.round((correctCount / total) * 100);
  const threshold = type === 'final' ? 0 : examThreshold(type);
  const passed = type === 'final' ? true : score >= threshold;

  const skill_updates = {};
  Object.keys(perSkill).forEach((skill) => {
    const s = perSkill[skill];
    skill_updates[skill] = { attemptScore: Math.round((s.correct / s.total) * 100), n: s.total };
  });

  return {
    correct_count: correctCount, total: questions.length, score, passed, pass_score: threshold,
    per_skill: perSkill, skill_updates
  };
}

module.exports = { gradeAttempt };
```

- [ ] **Step 6: اختبار المحرك** — أنشئ `scripts/test-engine.js`:

```js
// test-engine.js — اختبار وحدات للمحرك النقي (بدون شبكة). يعمل بسكربت node في كل بيئة.
const assert = require('assert');
const data = require('../api/course/engine/data');
const seq = require('../api/course/engine/sequence');
const skills = require('../api/course/engine/skills');
const examGen = require('../api/course/engine/exam-gen');
const scoring = require('../api/course/engine/scoring');

const course = data.getCourse();
const bank = data.getQuestionBank();

// 1) بنية المحتوى
assert(course.units.length === 5, '5 وحدات');
for (const u of course.units) {
  assert(u.lessons.length >= 2, 'كل وحدة ≥ درسين');
  for (const l of u.lessons) {
    assert(l.elements.length >= 2, 'كل درس ≥ عنصرين');
    for (const e of l.elements) {
      assert(data.questionsForElement(e.id).length >= 1, 'كل عنصر له سؤال: ' + e.id);
    }
  }
}

// 2) صحة الأسئلة
const seen = new Set();
for (const q of bank.questions) {
  assert(!seen.has(q.id), 'لا تكرار: ' + q.id); seen.add(q.id);
  assert(q.options instanceof Array && q.options.length === 4, '4 خيارات: ' + q.id);
  assert(Number.isInteger(q.correct_index) && q.correct_index >= 0 && q.correct_index <= 3, 'correct_index صالح: ' + q.id);
  assert(data.getElementById(q.element_id), 'العنصر موجود: ' + q.element_id);
}

// 3) التتابع: بداية فقط element الأول مفتوح
let snap = seq.computeSnapshot(course, []);
assert(seq.isElementOpen(snap, course.units[0].lessons[0].elements[0].id) === true, 'أول عنصر مفتوح');
const e2 = course.units[0].lessons[0].elements[1];
assert(seq.isElementOpen(snap, e2.id) === false, 'ثاني عنصر مقفول');

// 4) إتمام العناصر يفتح إمتحان الدرس
const lesson1 = course.units[0].lessons[0];
const completedList = lesson1.elements.map((e) => ({ ref_type: 'element', ref_id: e.id, status: 'completed', best_score: null }));
snap = seq.computeSnapshot(course, completedList);
assert(seq.isExamAvailable(snap, 'lesson', lesson1.id) === true, 'إمتحان الدرس متاح بعد إتمام العناصر');
assert(seq.isElementOpen(snap, e2.id) === false, 'العناصر بعد إتمامها لا تعود مفتوحة');

// 5) تسلسل الدروس: نجاح إمتحان درس يفتح أول عنصر من الدرس التالي
const lesson2 = course.units[0].lessons[1];
const passList = completedList.concat([{ ref_type: 'lesson', ref_id: lesson1.id, status: 'passed', best_score: 80 }]);
snap = seq.computeSnapshot(course, passList);
assert(seq.isElementOpen(snap, lesson2.elements[0].id) === true, 'أول عنصر من الدرس التالي مفتوح بعد النجاح');

// 6) عتبات النجاح
assert(seq.examThreshold('lesson') === 60 && seq.examThreshold('unit') === 50);

// 7) تحديث المهارات
const u = skills.updateSkill(null, 100, 4);
assert(u.mastery === 60 && u.n === 4, 'أول محاولة: 0.6×100 = 60');
const u2 = skills.updateSkill(u, 50, 4);
assert(u2.mastery > 50 && u2.mastery < 60, 'المحاولة التالية تؤثر بوزن أصغر');
const cls = skills.classifySkills({ 'dom-x': { mastery: 80, n: 5 }, 'dom-y': { mastery: 30, n: 5 } });
assert(cls.strengths.includes('dom-x') && cls.weaknesses.includes('dom-y'));
assert(skills.levelLabel(95) === 'ممتاز');

// 8) توليد امتحان درس يغطي كل عنصر ولا يكشف الإجابة
const exam = examGen.generateExam(course, bank, 'lesson', lesson1.id, {});
const examIds = new Set(exam.map((q) => q.id));
for (const e of lesson1.elements) {
  assert(data.questionsForElement(e.id).some((q) => examIds.has(q.id)), 'تغطية عنصر: ' + e.id);
}
assert(exam.every((q) => q.correct_index === undefined && q.explanation === undefined), 'لا تسريب للإجابة');

// 9) التصحيح
const q0 = bank.questions.find((x) => x.id === exam[0].id);
const result = scoring.gradeAttempt(bank, exam, [{ question_id: q0.id, selected_index: q0.correct_index }], 'lesson');
assert(result.total === exam.length && result.correct_count === 1, 'تصحيح صحيح');
assert(result.skill_updates[q0.skill], 'تحديث مهارة');

console.log('test-engine: ALL PASS');

// معالجة المتغير غير المستخدم (fill بحاجة masteryMap) — الحفظ
void data; void seq;
```

- [ ] **Step 7: تشغيل اختبار المحرك**

Run:
```powershell
node scripts/test-engine.js
```
Expected: `test-engine: ALL PASS`

- [ ] **Step 8: Commit**

```bash
git add api/course/engine scripts/test-engine.js
git commit -m "feat: محرك الدورة التعليمية (بيانات/تسلسل/مهارات/توليد امتحان/تصحيح)"
```

---

### Task 4: نقاط API (progress / exam / exam submit / adapt) + ربط الخادم

**Files:**
- Create: `api/course/helpers.js`
- Create: `api/course/progress.js`
- Create: `api/course/exam.js`
- Create: `api/course/exam/submit.js`
- Create: `api/course/adapt.js`
- Modify: `server.js`

**Interfaces:**
- Consumes: محرك Task 3 (`data`, `sequence`, `skills`, `exam-gen`, `scoring`) + `requireUser` من `api/supabase-server.js` + `readJsonBody` النمط من `api/chat.js`.
- Produces (تعتمد عليها الواجهة في Task 5):
  - `GET /api/course/progress` → `{ course, snapshot, profile }`
  - `POST /api/course/progress` body `{ref_type:"element", ref_id}` → `{ snapshot, profile }` (أو 403 عند مقفول/خاطئ)
  - `GET /api/course/exam?type=lesson|unit|final&ref=...` → `{ attempt_id, exam_type, ref_id, pass_score, questions:[{index,question_id,question,options}] }`
  - `POST /api/course/exam/submit` body `{attempt_id, answers:[{question_id,selected_index,response_time_sec}]}` → `{ result, snapshot }`
  - `POST /api/course/adapt` body `{lesson_id, element_id}` → `{ element_id, explanation, example }`
- الحالة `profile`: `{ overall_mastery, overall_level, strengths[], weaknesses[], skills:{skill:{mastery,n}} }`.

- [ ] **Step 1: helpers.js** — أنشئ `api/course/helpers.js`:

```js
// helpers.js — مشتركات جلّامي مسارات الدورة: قراءة الجسم، الردود الموحدة، تحميل الملف الشخصي.
const { getSupabase } = require('../supabase-server');

function readJsonBody(req, callback) {
  if (req.body && typeof req.body === 'object') {
    callback(req.body);
    return;
  }
  let body = '';
  req.on('data', function (chunk) {
    body += chunk;
    if (body.length > 1e6) req.destroy();
  });
  req.on('end', function () {
    try {
      callback(body ? JSON.parse(body) : {});
    } catch (err) {
      callback({ __invalid: true, message: err.message });
    }
  });
}

function send(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

async function getLearnerState(supabase, userId) {
  const [progressRes, skillRes, profileRes] = await Promise.all([
    supabase.from('course_progress').select('ref_type,ref_id,status,best_score').eq('user_id', userId),
    supabase.from('course_skill_profiles').select('skill,mastery,n').eq('user_id', userId),
    supabase.from('student_learning_profile').select('*').eq('user_id', userId).maybeSingle()
  ]);
  if (progressRes.error) throw progressRes.error;
  if (skillRes.error) throw skillRes.error;
  if (profileRes.error) throw profileRes.error;

  const skillMap = {};
  (skillRes.data || []).forEach((r) => { skillMap[r.skill] = { mastery: r.mastery, n: r.n }; });

  const profile = {
    overall_mastery: (profileRes.data && profileRes.data.overall_mastery) || 0,
    overall_level: (profileRes.data && profileRes.data.overall_level) || 'مبتدئ',
    strengths: (profileRes.data && profileRes.data.strengths) || [],
    weaknesses: (profileRes.data && profileRes.data.weaknesses) || [],
    skills: skillMap
  };
  return { progress: progressRes.data || [], skillMap, profileRow: profileRes.data, profile };
}

async function saveLearningProfile(supabase, userId, skillMap, profile) {
  const { strengths, weaknesses } = require('./engine/skills').classifySkills(skillMap);
  const overall_mastery = require('./engine/skills').overallMastery(skillMap);
  const overall_level = require('./engine/skills').levelLabel(overall_mastery);
  const payload = {
    user_id: userId, overall_mastery, overall_level,
    strengths, weaknesses,
    adaptation_overrides: (profile && profile.adaptation_overrides) || {},
    current_position: (profile && profile.current_position) || null
  };
  const { error } = await supabase.from('student_learning_profile').upsert(payload, { onConflict: 'user_id' });
  if (error) throw error;
  return { overall_mastery, overall_level, strengths, weaknesses };
}

function isBlank(v) {
  return v === undefined || v === null || v === '';
}

module.exports = { readJsonBody, send, getLearnerState, saveLearningProfile, isBlank };
```

- [ ] **Step 2: progress.js** — أنشئ `api/course/progress.js`:

```js
const { requireUser } = require('../supabase-server');
const helpers = require('./helpers');
const data = require('./engine/data');
const seq = require('./engine/sequence');

function snapshotFrom(state) {
  const course = data.getCourse();
  const snap = seq.computeSnapshot(course, state.progress);
  return snap;
}

function responseOf(state) {
  const course = data.getCourse();
  return {
    course: { title: course.title, version: course.version },
    snapshot: snapshotFrom(state),
    profile: state.profile
  };
}

async function handleGet(req, res, auth) {
  const state = await helpers.getLearnerState(auth.supabase, auth.userId);
  helpers.send(res, 200, responseOf(state));
}

async function handlePost(req, res, auth, body) {
  if (body.__invalid) { helpers.send(res, 400, { error: 'طلب غير صالح: ' + body.message }); return; }
  const refType = body.ref_type;
  const refId = body.ref_id;
  if (refType !== 'element' || helpers.isBlank(refId) || !data.getElementById(refId)) {
    helpers.send(res, 400, { error: 'ref غير صالح. أكمل عنصراً موجوداً فقط (ref_type=element).' });
    return;
  }
  const state = await helpers.getLearnerState(auth.supabase, auth.userId);
  const snap = seq.computeSnapshot(data.getCourse(), state.progress);
  if (!seq.isElementOpen(snap, refId)) {
    helpers.send(res, 403, { error: 'هذا العنصر مقفول. أكمل ما قبله أولاً.' });
    return;
  }
  await auth.supabase.from('course_progress').upsert(
    { user_id: auth.userId, ref_type: 'element', ref_id: refId, status: 'completed', completed_at: new Date().toISOString() },
    { onConflict: 'user_id,ref_type,ref_id' }
  );
  const fresh = await helpers.getLearnerState(auth.supabase, auth.userId);
  helpers.send(res, 200, responseOf(fresh));
}

async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    helpers.send(res, 405, { error: 'Method not allowed' });
    return;
  }
  const auth = await requireUser(req, res);
  if (!auth) return;
  try {
    if (req.method === 'GET') await handleGet(req, res, auth);
    else helpers.readJsonBody(req, (body) => handlePost(req, res, auth, body).catch((err) => {
      console.error('progress POST error:', err);
      if (!res.headersSent) helpers.send(res, 500, { error: 'خطأ داخلي: ' + err.message });
    }));
  } catch (err) {
    console.error('progress error:', err);
    if (!res.headersSent) helpers.send(res, 500, { error: 'خطأ داخلي: ' + err.message });
  }
}

module.exports = handler;
module.exports.default = handler;
```

- [ ] **Step 3: exam.js** — أنشئ `api/course/exam.js`:

```js
const { requireUser } = require('../supabase-server');
const helpers = require('./helpers');
const data = require('./engine/data');
const seq = require('./engine/sequence');
const examGen = require('./engine/exam-gen');

async function handler(req, res) {
  if (req.method !== 'GET') { helpers.send(res, 405, { error: 'Method not allowed' }); return; }
  const auth = await requireUser(req, res);
  if (!auth) return;

  const url = new URL(req.url, 'http://localhost');
  const type = url.searchParams.get('type');
  const ref = url.searchParams.get('ref');
  if (!['lesson', 'unit', 'final'].includes(type) || helpers.isBlank(ref)) {
    helpers.send(res, 400, { error: 'type (lesson|unit|final) و ref مطلوبان.' });
    return;
  }
  if (type === 'lesson' && !data.getLessonById(ref)) { helpers.send(res, 404, { error: 'درس غير موجود.' }); return; }
  if (type === 'unit' && !data.getUnitById(ref)) { helpers.send(res, 404, { error: 'وحدة غير موجودة.' }); return; }

  try {
    const state = await helpers.getLearnerState(auth.supabase, auth.userId);
    const snap = seq.computeSnapshot(data.getCourse(), state.progress);
    if (!seq.isExamAvailable(snap, type, ref)) {
      helpers.send(res, 403, { error: 'هذا الإمتحان غير متاح بعد. أكمل ما قبله أولاً.' });
      return;
    }

    const course = data.getCourse();
    const bank = data.getQuestionBank();
    const masteryMap = state.skillMap;
    const questions = examGen.generateExam(course, bank, type, ref, masteryMap);
    if (!questions.length) {
      helpers.send(res, 409, { error: 'بنك الأسئلة فارغ أو غير كافٍ لهذا الامتحان.' });
      return;
    }

    const { data: attemptData, error } = await auth.supabase.from('course_exam_attempts').insert({
      user_id: auth.userId, exam_type: type, ref_id: ref,
      total_questions: questions.length, correct_count: 0, score: 0, passed: false
    }).select('id').single();
    if (error) throw error;

    helpers.send(res, 200, {
      attempt_id: attemptData.id,
      exam_type: type,
      ref_id: ref,
      pass_score: seq.examThreshold(type),
      instructions: {
        title: type === 'lesson' ? 'إمتحان الدرس' : type === 'unit' ? 'إختبار الوحدة' : 'الإمتحان الشامل',
        total: questions.length
      },
      questions: questions.map((q, i) => ({
        index: i, question_id: q.id, question: q.question, options: q.options, skill: q.skill
      }))
    });
  } catch (err) {
    console.error('exam error:', err);
    if (!res.headersSent) helpers.send(res, 500, { error: 'خطأ داخلي: ' + err.message });
  }
}

module.exports = handler;
module.exports.default = handler;
```

- [ ] **Step 4: exam/submit.js** — أنشئ `api/course/exam/submit.js`:

```js
const { requireUser } = require('../../supabase-server');
const helpers = require('../helpers');
const data = require('../engine/data');
const seq = require('../engine/sequence');
const skillsUtil = require('../engine/skills');
const scoring = require('../engine/scoring');

async function handler(req, res) {
  if (req.method !== 'POST') { helpers.send(res, 405, { error: 'Method not allowed' }); return; }
  const auth = await requireUser(req, res);
  if (!auth) return;

  helpers.readJsonBody(req, async function (body) {
    try {
      if (body.__invalid) { helpers.send(res, 400, { error: 'طلب غير صالح: ' + body.message }); return; }
      const attemptId = body.attempt_id;
      if (!attemptId) { helpers.send(res, 400, { error: 'attempt_id مطلوب.' }); return; }

      const supabase = auth.supabase;
      const { data: attempt, error } = await supabase.from('course_exam_attempts').select('*').eq('id', attemptId).single();
      if (error || !attempt) { helpers.send(res, 404, { error: 'محاولة غير موجودة.' }); return; }
      if (attempt.submitted_at) {
        const result = await buildResult(supabase, auth.userId, attempt, body.answers || [], true);
        helpers.send(res, 200, result);
        return;
      }

      const examQuestions = await loadExamQuestions(body.answers || []);
      const grade = scoring.gradeAttempt(data.getQuestionBank(), examQuestions, body.answers || [], attempt.exam_type);
      const duration = Math.max(0, Math.round((Date.now() - new Date(attempt.started_at).getTime()) / 1000));

      // تحديث ملفات المهارات
      const { data: existingSkills } = await supabase.from('course_skill_profiles').select('skill,mastery,n').eq('user_id', auth.userId);
      const current = {};
      (existingSkills || []).forEach((r) => { current[r.skill] = { mastery: r.mastery, n: r.n }; });
      for (const skill of Object.keys(grade.skill_updates)) {
        const upd = grade.skill_updates[skill];
        const next = skillsUtil.updateSkill(current[skill], upd.attemptScore, upd.n);
        current[skill] = next;
        await supabase.from('course_skill_profiles').upsert(
          { user_id: auth.userId, skill, mastery: next.mastery, n: next.n },
          { onConflict: 'user_id,skill' }
        );
      }

      // حفظ النتيجة والأجوبة
      await supabase.from('course_exam_attempts').update({
        correct_count: grade.correct_count, score: grade.score, passed: grade.passed,
        submitted_at: new Date().toISOString(), duration_sec: duration
      }).eq('id', attemptId);

      const answersRows = (body.answers || []).map((a) => {
        const q = data.questionById(a.question_id);
        return {
          attempt_id: attemptId,
          question_id: a.question_id,
          skill: q ? q.skill : '',
          difficulty: q ? q.difficulty : 1,
          selected_index: typeof a.selected_index === 'number' ? a.selected_index : null,
          is_correct: q ? a.selected_index === q.correct_index : false,
          response_time_sec: Math.max(0, Math.round(a.response_time_sec || 0))
        };
      });
      if (answersRows.length) await supabase.from('course_exam_answers').insert(answersRows);

      // فتح المسار حسب نوع الامتحان
      await unlockAfterExam(supabase, auth.userId, attempt, grade);

      const result = await buildResult(supabase, auth.userId, attempt, body.answers || [], false, grade);
      helpers.send(res, 200, result);
    } catch (err) {
      console.error('exam submit error:', err);
      if (!res.headersSent) helpers.send(res, 500, { error: 'خطأ داخلي: ' + err.message });
    }
  });
}

async function loadExamQuestions(answers) {
  const ids = (answers || []).map((a) => a.question_id).filter(Boolean);
  const bank = data.getQuestionBank();
  return ids.map((id) => bank.questions.find((q) => q.id === id)).filter(Boolean);
}

async function unlockAfterExam(supabase, userId, attempt, grade) {
  if (attempt.exam_type === 'lesson' && grade.passed) {
    // الإمتحان مرّ: نُثبت نجاح الدرس (لا يفتح غيره؛ أول عنصر من الدرس التالي يفتحه computeSnapshot).
    await supabase.from('course_progress').upsert(
      { user_id: userId, ref_type: 'lesson', ref_id: attempt.ref_id, status: 'passed', best_score: grade.score },
      { onConflict: 'user_id,ref_type,ref_id' }
    );
  } else if (attempt.exam_type === 'unit' && grade.passed) {
    await supabase.from('course_progress').upsert(
      { user_id: userId, ref_type: 'unit', ref_id: attempt.ref_id, status: 'passed', best_score: grade.score },
      { onConflict: 'user_id,ref_type,ref_id' }
    );
  } else if (attempt.exam_type === 'final') {
    await supabase.from('course_progress').upsert(
      { user_id: userId, ref_type: 'exam_final', ref_id: 'final', status: 'completed', best_score: grade.score },
      { onConflict: 'user_id,ref_type,ref_id' }
    );
  }
  // أفضل درجة تُحفظ دائماً حتى عند الرسوب
  const { data: row } = await supabase.from('course_progress')
    .select('best_score').eq('user_id', userId).eq('ref_type', attempt.exam_type === 'lesson' ? 'lesson' : attempt.exam_type === 'unit' ? 'unit' : 'exam_final')
    .eq('ref_id', attempt.exam_type === 'final' ? 'final' : attempt.ref_id).maybeSingle();
  const best = Math.max((row && row.best_score) || 0, grade.score);
  await supabase.from('course_progress').upsert(
    { user_id: userId, ref_type: attempt.exam_type === 'lesson' ? 'lesson' : attempt.exam_type === 'unit' ? 'unit' : 'exam_final',
      ref_id: attempt.exam_type === 'final' ? 'final' : attempt.ref_id,
      status: grade.passed ? (attempt.exam_type === 'final' ? 'completed' : 'passed') : (row && row.status) || 'locked',
      best_score: best },
    { onConflict: 'user_id,ref_type,ref_id' }
  );
}

async function buildResult(supabase, userId, attempt, answers, reload, forcedGrade) {
  let grade = forcedGrade;
  if (!grade) {
    const examQuestions = await loadExamQuestions(answers);
    grade = scoring.gradeAttempt(data.getQuestionBank(), examQuestions, answers, attempt.exam_type);
  }
  const state = await helpers.getLearnerState(supabase, userId);
  const snap = seq.computeSnapshot(data.getCourse(), state.progress);
  return {
    result: {
      exam_type: attempt.exam_type, ref_id: attempt.ref_id,
      total: grade.total, correct_count: grade.correct_count, score: grade.score, passed: grade.passed,
      pass_score: grade.pass_score,
      per_skill: grade.per_skill,
      strengths: state.profile.strengths, weaknesses: state.profile.weaknesses,
      overall_mastery: state.profile.overall_mastery, overall_level: state.profile.overall_level
    },
    snapshot: snap
  };
}

module.exports = handler;
module.exports.default = handler;
```

- [ ] **Step 5: adapt.js** — أنشئ `api/course/adapt.js`:

```js
// adapt.js — شرح مبسّط لمهارة ضعيفة من المدرّس الذكي مع إحتياط عند فشل الذكاء الاصطناعي.
const { requireUser, getSupabaseConfig } = require('../supabase-server');
const helpers = require('./helpers');
const data = require('./engine/data');

const SYSTEM = 'أنت "المدرس الشخصي للفيزياء". اشرح المفهوم بطريقة أبسط جداً لطالب ثانوي بالعربية، ثم أعط مثالاً تطبيقياً قصيراً واحداً محلولاً. أعد الناتج بصيغة JSON فقط: {"explanation":"...","example":"..."} بدون أي نص آخر.';

async function handle(req, res, auth) {
  helpers.readJsonBody(req, async (body) => {
    try {
      if (body.__invalid) { helpers.send(res, 400, { error: 'طلب غير صالح: ' + body.message }); return; }
      const element = data.getElementById(body.element_id);
      if (!element) { helpers.send(res, 404, { error: 'عنصر غير موجود.' }); return; }

      const { data: profileRow } = await auth.supabase.from('student_learning_profile').select('adaptation_overrides').eq('user_id', auth.userId).maybeSingle();
      const overrides = (profileRow && profileRow.adaptation_overrides) || {};
      const cacheKey = 'element:' + element.id;
      if (overrides[cacheKey]) {
        helpers.send(res, 200, { element_id: element.id, explanation: overrides[cacheKey].explanation, example: overrides[cacheKey].example, cached: true });
        return;
      }

      const lesson = data.getLessonById(element.lesson_id || inferLesson(element.id));
      const context = JSON.stringify({
        element_title: element.title,
        element_explanation: element.explanation,
        lesson_examples: lesson ? lesson.examples : []
      }).slice(0, 14000);

      let result = null;
      try {
        result = await callOpenRouter(context, element.skills || []);
      } catch (err) {
        console.warn('adapt OpenRouter failed, using fallback:', err.message);
        result = null;
      }

      if (!result) {
        const fallbackQ = data.questionsForElement(element.id).find((q) => q.explanation);
        result = {
          explanation: (fallbackQ && fallbackQ.explanation) || element.explanation,
          example: (lesson && lesson.examples[0] && lesson.examples[0].body) || 'أعد قراءة الشرح وحاول حل سؤال مساعد.'
        };
      }

      const safe = { explanation: String(result.explanation || '').slice(0, 3000), example: String(result.example || '').slice(0, 1500) };
      const nextOverrides = Object.assign({}, overrides, { [cacheKey]: safe });
      await auth.supabase.from('student_learning_profile').upsert(
        { user_id: auth.userId, adaptation_overrides: nextOverrides },
        { onConflict: 'user_id' }
      );
      helpers.send(res, 200, { element_id: element.id, explanation: safe.explanation, example: safe.example, cached: false });
    } catch (err) {
      console.error('adapt error:', err);
      if (!res.headersSent) helpers.send(res, 500, { error: 'خطأ داخلي: ' + err.message });
    }
  });
}

function inferLesson(elementId) {
  const m = /^(u\d+l\d+)s\xd8/.exec(elementId) || /^(u\d+l\d+)s\d/.exec(elementId);
  return m ? m[1] : null;
}

async function callOpenRouter(context, skills) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('no key');
  const { url, anonKey } = getSupabaseConfig();
  void anonKey; void url;
  const prompt =
    'فهم في المهارات: ' + JSON.stringify(skills) + '\n' +
    'محتوى العنصر:\n' + context;

  const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + key,
      'HTTP-Referer': process.env.APP_URL || 'http://localhost:5500',
      'X-Title': 'Physics Tutor'
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: prompt }
      ],
      temperature: 0.4
    })
  });
  if (!upstream.ok) throw new Error('openrouter ' + upstream.status);
  const payload = await upstream.json();
  const text = (payload.choices && payload.choices[0] && payload.choices[0].message && payload.choices[0].message.content) || '';
  try {
    const parsed = JSON.parse(text.replace(/```json|```/g, ''));
    if (parsed && parsed.explanation) return parsed;
  } catch (e) { /* tex diff */ }
  if (text && text.length > 200) {
    return { explanation: text, example: '' };
  }
  throw new Error('empty ai response');
}

async function handler(req, res) {
  if (req.method !== 'POST') { helpers.send(res, 405, { error: 'Method not allowed' }); return; }
  const auth = await requireUser(req, res);
  if (!auth) return;
  await handle(req, res, auth);
}

module.exports = handler;
module.exports.default = handler;
```

- [ ] **Step 6: ربط server.js** — عدّل `server.js`: أضف imports و routes قبل تسليم الملفات الثابتة:

```js
const courseProgressHandler = require('./api/course/progress');
const courseExamHandler = require('./api/course/exam');
const courseExamSubmitHandler = require('./api/course/exam/submit');
const courseAdaptHandler = require('./api/course/adapt');
```
وبعد block `/api/config`:
```js
  if (urlPath === '/api/course/progress') { courseProgressHandler(req, res); return; }
  if (urlPath === '/api/course/exam' && req.method === 'GET') { courseExamHandler(req, res); return; }
  if (urlPath === '/api/course/exam/submit') { courseExamSubmitHandler(req, res); return; }
  if (urlPath === '/api/course/adapt') { courseAdaptHandler(req, res); return; }
```

- [ ] **Step 7: بدء الخادم والتحقق من التحميل**

Run:
```powershell
node server.js
```
ثم في نافذة أخرى:
```powershell
node scripts/test-engine.js
```
Expected: `test-engine: ALL PASS` (محرك مستقل عن الشبكة). والواجهات تُفحص في Task 6.

- [ ] **Step 8: Commit**

```bash
git add api/course server.js
git commit -m "feat: نقاط API للدورة التعليمية (progress/exam/submit/adapt) مع ربط الخادم"
```

---

### Task 5: الواجهة الأمامية — تبويب الدورات وشاشاتها

**Files:**
- Modify: `public/index.html`
- Create: `public/course.js`
- Modify: `public/style.css`
- Modify: `public/app.js` (استدعاء `CourseApp.init()` عند تحميل الدورة؛ إخفاء عند الخروج)

**Interfaces:**
- Consumes: نقاط API Task 4 + `window.AppAuth.getSession()` (من `auth.js`) + `window.KaTeX` (منصوب) + `window.CourseApp`.
- Produces: `window.CourseApp.init()`, `CourseApp.showTab('course')`؛ وأقسام HTML جاهزة في `index.html`.

- [ ] **Step 1: أقسام HTML + التبويبات** — عدّل `public/index.html`:

أ) داخل `<header class="site-header">` بعد `</div>` الحالية لـ `.header-inner` أضف شريط تبويبات (قبل إغلاق `</header>`):
```html
    <nav class="tab-nav">
      <button id="tab-summaries" class="tab-btn active">الملخصات</button>
      <button id="tab-course" class="tab-btn">الدورة التعليمية</button>
    </nav>
```

ب) بعد إغلاق `<section id="reader-view">` وقبل `</main>` أضف قسمين (يملأهما course.js):

```html
    <section id="course-tab" class="view hidden">
      <div id="course-dashboard" class="course-inner"></div>
      <div id="course-lesson-view" class="course-inner hidden">
        <button id="course-back-lesson" class="back-btn">→ العودة إلى الدورة</button>
        <div id="course-breadcrumb" class="course-breadcrumb"></div>
        <div id="course-element"></div>
        <div id="course-element-actions" class="course-actions"></div>
        <div id="course-adapt-card" class="course-adapt hidden"></div>
      </div>
      <div id="course-exam-view" class="course-inner hidden">
        <div id="course-exam-head" class="course-exam-head"></div>
        <div id="course-exam-q" class="course-exam-q"></div>
        <div id="course-exam-actions" class="course-actions"></div>
      </div>
      <div id="course-result-view" class="course-inner hidden">
        <div id="course-result"></div>
      </div>
      <p id="course-msg" class="course-msg hidden"></p>
    </section>
```

ج) أضف `<script src="course.js"></script>` قبل `<script src="app.js"></script>`.

- [ ] **Step 2: course.js** — أنشئ `public/course.js` (نفس نمط app.js: IIFE، دون إطار):

```js
(function () {
  var api = function (path, opts) {
    opts = opts || {};
    var session = window.AppAuth && window.AppAuth.getSession();
    var token = session && session.access_token;
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    return fetch(path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) throw new Error(j && j.error ? j.error : 'خطأ في الخادم');
        return j;
      });
    });
  };

  var els = {
    tabCourse: document.getElementById('tab-course'),
    tabSummaries: document.getElementById('tab-summaries'),
    dashboard: document.getElementById('course-dashboard'),
    lessonView: document.getElementById('course-lesson-view'),
    examView: document.getElementById('course-exam-view'),
    resultView: document.getElementById('course-result-view'),
    breadcrumb: document.getElementById('course-breadcrumb'),
    element: document.getElementById('course-element'),
    elementActions: document.getElementById('course-element-actions'),
    adaptCard: document.getElementById('course-adapt-card'),
    msg: document.getElementById('course-msg'),
    examHead: document.getElementById('course-exam-head'),
    examQ: document.getElementById('course-exam-q'),
    examActions: document.getElementById('course-exam-actions'),
    result: document.getElementById('course-result'),
    backLesson: document.getElementById('course-back-lesson')
  };

  var state = { snapshot: null, profile: null, element: null, exam: null, currentIndex: 0, answers: {} };

  function show(id, show) {
    var v = document.getElementById(id);
    if (v) v.classList.toggle('hidden', !show);
  }

  function setMsg(text, isError) {
    els.msg.textContent = text || '';
    els.msg.classList.toggle('hidden', !text);
    els.msg.classList.toggle('error', !!isError);
  }

  function renderMathInline(node) {
    if (!node) return;
    node.querySelectorAll('.math').forEach(function (el) {
      var tex = el.getAttribute('data-tex');
      if (window.katex && tex) {
        try { el.innerHTML = window.katex.renderToString(tex, { throwOnError: false, displayMode: false }); } catch (e) { /* keep */ }
      }
    });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function renderDash() {
    var snap = state.snapshot;
    if (!snap) return;
    var doneUnits = snap.units.filter(function (u) { return u.status === 'passed'; }).length;
    var score = Math.round((doneUnits / snap.units.length) * 100);
    var profile = state.profile || {};
    var html = '';
    html += '<div class="course-overall">';
    html += '<div class="course-progress-bar"><div class="course-progress-fill" style="width:' + score + '%"></div></div>';
    html += '<p class="course-overall-label">تقدم الدورة: ' + doneUnits + ' من ' + snap.units.length + ' وحدات ناجحة (' + score + '%)</p>';
    if (profile.overall_level) html += '<p class="course-level">المستوى العام: <strong>' + esc(profile.overall_level) + '</strong></p>';
    if ((profile.strengths || []).length) html += '<p class="course-chip-row">نقاط قوة: ' + (profile.strengths || []).map(function (s) { return '<span class="chip chip-good">' + esc(s) + '</span>'; }).join(' ') + '</p>';
    if ((profile.weaknesses || []).length) html += '<p class="course-chip-row">نقاط ضعف: ' + (profile.weaknesses || []).map(function (s) { return '<span class="chip chip-warn">' + esc(s) + '</span>'; }).join(' ') + '</p>';
    html += '</div>';
    html += '<div class="course-units">';
    snap.units.forEach(function (u) {
      var icon = u.status === 'passed' ? '✔' : u.status === 'locked' ? '🔒' : '▶';
      html += '<div class="course-unit-card ' + (u.status === 'locked' ? 'locked' : '') + '">';
      html += '<div class="course-unit-head"><span class="course-unit-icon">' + icon + '</span>';
      html += '<div><h3>' + esc(u.title) + '</h3><p>' + esc(u.description || '') + '</p></div></div>';
      html += '<div class="course-lessons">';
      u.lessons.forEach(function (l) {
        var licon = l.status === 'passed' ? '✔' : l.status === 'exam_ready' ? '✍' : (l.status === 'open' ? '▶' : '🔒');
        var doneEl = l.elements.filter(function (e) { return e.status === 'completed'; }).length;
        html += '<div class="course-lesson ' + (l.status === 'locked' ? 'locked' : '') + '" data-lesson="' + esc(l.id) + '" data-locked="' + (l.status === 'locked') + '" data-exam-ready="' + (l.status === 'exam_ready' || l.status === 'passed') + '">';
        html += '<span class="course-lesson-icon">' + licon + '</span>';
        html += '<div class="course-lesson-body"><strong>' + esc(l.title) + '</strong>';
        html += '<div class="course-elements">';
        l.elements.forEach(function (e, i) {
          var eic = e.status === 'completed' ? '✔' : e.status === 'open' ? '◌' : '•';
          html += '<span class="course-dot ' + e.status + '" data-element="' + esc(e.id) + '">' + eic + ' ' + esc(e.title) + '</span>';
        });
        html += '</div>';
        html += '</div>';
        if (l.exam && l.exam.status === 'available') {
          html += '<button class="btn-exam" data-exam="lesson:' + esc(l.id) + '">' + (l.status === 'passed' ? 'إعادة إمتحان الدرس' : 'إمتحان الدرس') + '</button>';
        }
        html += '</div>';
      });
      html += '</div>';
      if (u.unit_exam.status === 'available') {
        html += '<button class="btn-exam btn-unit-exam" data-exam="unit:' + esc(u.id) + '">' + (u.status === 'passed' ? 'إعادة إختبار الوحدة' : 'إختبار الوحدة') + '</button>';
      }
      html += '</div>';
    });
    if (snap.final_exam.status === 'available') {
      html += '<button class="btn-exam btn-final" data-exam="final:final">الإمتحان الشامل</button>';
    }
    html += '</div>';
    els.dashboard.innerHTML = html;

    els.dashboard.querySelectorAll('[data-exam]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var parts = btn.getAttribute('data-exam').split(':');
        startExam(parts[0], parts[1]);
      });
    });
    els.dashboard.querySelectorAll('[data-lesson]').forEach(function (row) {
      row.addEventListener('click', function (ev) {
        if (ev.target.closest('[data-exam]') || ev.target.closest('[data-element]')) return;
        if (row.getAttribute('data-locked') === 'true') { setMsg('أكمل ما قبل هذا الدرس أولاً.', true); return; }
        openLesson(row.getAttribute('data-lesson'));
      });
    });
    els.dashboard.querySelectorAll('[data-element]').forEach(function (dot) {
      dot.addEventListener('click', function () {
        var stateEl = dot.getAttribute('data-element');
        openElement(stateEl);
      });
    });
  }

  function findLesson(lessonId) {
    var snap = state.snapshot;
    for (var i = 0; i < snap.units.length; i++) {
      for (var j = 0; j < snap.units[i].lessons.length; j++) {
        if (snap.units[i].lessons[j].id === lessonId) return snap.units[i].lessons[j];
      }
    }
    return null;
  }

  function openLesson(lessonId) {
    var lesson = findLesson(lessonId);
    if (!lesson) return;
    var first = lesson.elements.find(function (e) { return e.status === 'open' || e.status === 'completed'; });
    if (!first) { setMsg('لا يوجد عنصر متاح.'); return; }
    openElement(first.id, lessonId);
  }

  function openElement(elementId, lessonId) {
    setMsg('');
    var elemsByLesson = null;
    var courseRaw = null;
    return api('/api/course/progress').then(function (data) {
      state.snapshot = data.snapshot;
      state.profile = data.profile;
      var lesson = lessonId || findLessonForElement(elementId, data.snapshot);
      renderElement(elementId, lesson, data);
    });
  }

  function findLessonForElement(elementId, snap) {
    for (var i = 0; i < snap.units.length; i++) {
      for (var j = 0; j < snap.units[i].lessons.length; j++) {
        var l = snap.units[i].lessons[j];
        if (l.elements.some(function (e) { return e.id === elementId; })) return l;
      }
    }
    return null;
  }

  function renderElement(elementId, lesson, data) {
    state.element = { elementId: elementId, lessonId: lesson ? lesson.id : null };
    show('course-dashboard', false);
    show('course-exam-view', false);
    show('course-result-view', false);
    show('course-lesson-view', true);

    ls: {
      var lsnap = lesson || {};
      els.breadcrumb.innerHTML = '<span>' + esc((lsnap.title || 'درس')) + ' — ' + esc(lsnap.elements ? lsnap.elements.length : '') + ' عناصر</span>';
    }

    fetch('course/course.json').then(function (r) { return r.json(); }).then(function (course) {
      var found = null;
      course.units.forEach(function (u) { u.lessons.forEach(function (l) { l.elements.forEach(function (e) {
        if (e.id === elementId) found = { course: course, unit: u, lesson: l, elem: e, index: l.elements.indexOf(e) };
      }); }); });
      if (!found) { setMsg('عنصر غير موجود.', true); return; }
      renderElementBody(found);
    });
  }

  function renderElementBody(found) {
    var e = found.elem;
    var lesson = found.lesson;
    var hasWeakness = (state.profile && state.profile.weaknesses || []).some(function (s) { return (e.skills || []).indexOf(s) >= 0; });

    var html = '';
    html += '<h2>' + esc(e.title) + '</h2>';
    html += '<p class="course-element-position">' + (found.index + 1) + ' / ' + found.lesson.elements.length + '</p>';
    html += '<div class="course-box course-explanation">' + esc(e.explanation) + '</div>';
    if ((e.formulas || []).length) {
      html += '<div class="course-box course-formulas">';
      e.formulas.forEach(function (f) { html += '<div class="math" data-tex="' + esc(f) + '">' + esc(f) + '</div>'; });
      html += '</div>';
    }
    var examples = (lesson.examples || []).concat(e.examples || []);
    if (examples.length) {
      html += '<div class="course-box"><h3>أمثلة</h3>';
      examples.forEach(function (ex) {
        html += '<div class="course-example"><strong>' + esc(ex.title) + '</strong><p>' + esc(ex.body) + '</p></div>';
      });
      html += '</div>';
    }

    var isLast = found.index === found.lesson.elements.length - 1;
    var currentStatus = state.snapshot && findLessonForElement(e.id, state.snapshot);
    var alreadyDone = currentStatus && currentStatus.elements.some(function (el) { return el.id === e.id && el.status === 'completed'; });
    els.element.innerHTML = html;
    renderMathInline(els.element);

    els.elementActions.innerHTML = '';
    if (!isLast) {
      var btnNext = document.createElement('button');
      btnNext.className = 'btn-primary';
      btnNext.textContent = alreadyDone ? 'العنصر التالي' : 'أتممت العنصر؟ (التالي)';
      btnNext.addEventListener('click', function () { completeAndAdvance(e.id, found.lesson.id, found.index); });
      els.elementActions.appendChild(btnNext);
    } else {
      var btnExam = document.createElement('button');
      btnExam.className = 'btn-primary';
      btnExam.textContent = alreadyDone ? 'إلى إمتحان الدرس' : 'أتممت العنصر؟ (إلى الإمتحان)';
      btnExam.addEventListener('click', function () { completeAndStartExam(e.id, found.lesson.id); });
      els.elementActions.appendChild(btnExam);
    }

    if (hasWeakness && !alreadyDone) {
      els.adaptCard.classList.remove('hidden');
      els.adaptCard.innerHTML = '<button id="course-adapt-btn" class="btn-link">اشرح لي بطريقة أبسط</button><div id="course-adapt-body" class="hidden"></div>';
      document.getElementById('course-adapt-btn').addEventListener('click', loadAdapt(e.id));
    } else {
      els.adaptCard.classList.add('hidden');
    }
  }

  function completeAndAdvance(elementId, lessonId, index) {
    api('/api/course/progress', { method: 'POST', body: { ref_type: 'element', ref_id: elementId } }).then(function (data) {
      state.snapshot = data.snapshot;
      state.profile = data.profile;
      var lesson = findLesson(lessonId);
      var nextEl = lesson && lesson.elements[index + 1];
      if (nextEl && nextEl.status === 'open') renderElement(nextEl.id, lesson, data);
      else renderDash(); show('course-lesson-view', false); show('course-dashboard', true);
    }).catch(function (err) { setMsg(err.message, true); });
  }

  function completeAndStartExam(elementId, lessonId) {
    api('/api/course/progress', { method: 'POST', body: { ref_type: 'element', ref_id: elementId } })
      .then(function () { return startExam('lesson', lessonId); })
      .catch(function (err) { setMsg(err.message, true); });
  }

  function startExam(type, refId) {
    setMsg('');
    api('/api/course/exam?type=' + encodeURIComponent(type) + '&ref=' + encodeURIComponent(refId)).then(function (data) {
      state.exam = data;
      state.currentIndex = 0;
      state.answers = {};
      show('course-dashboard', false);
      show('course-lesson-view', false);
      show('course-result-view', false);
      show('course-exam-view', true);
      renderExamQuestion();
    }).catch(function (err) { setMsg(err.message, true); });
  }

  function renderExamQuestion() {
    var q = state.exam.questions[state.currentIndex];
    if (!q) return;
    els.examHead.innerHTML = '<p><strong>' + esc(state.exam.instructions.title) + '</strong> — السؤال ' + (state.currentIndex + 1) + ' من ' + state.exam.questions.length + ' — نسبة النجاح: ' + state.exam.pass_score + '%</p>';
    els.examQ.innerHTML = '<h3>' + esc(q.question) + '</h3><div class="course-options">' + q.options.map(function (opt, i) {
      var chosen = state.answers[q.question_id] === i;
      return '<label class="course-option ' + (chosen ? 'chosen' : '') + '"><input type="radio" name="course-ans" value="' + i + '" ' + (chosen ? 'checked' : '') + '> ' + esc(opt) + '</label>';
    }).join('') + '</div>';
    els.examQ.querySelectorAll('input[name=course-ans]').forEach(function (input) {
      input.addEventListener('change', function () {
        state.answers[q.question_id] = parseInt(input.value, 10);
        renderExamActions();
      });
    });
    els.examActions.innerHTML = '';
    if (state.currentIndex > 0) {
      var bPrev = document.createElement('button');
      bPrev.className = 'btn-secondary';
      bPrev.textContent = 'السابق';
      bPrev.addEventListener('click', function () { state.currentIndex--; renderExamQuestion(); });
      els.examActions.appendChild(bPrev);
    }
    var isAnswered = state.answers[q.question_id] !== undefined;
    var bNext = document.createElement('button');
    bNext.className = 'btn-primary';
    bNext.disabled = !isAnswered;
    bNext.textContent = state.currentIndex === state.exam.questions.length - 1 ? 'مراجعة وإرسال' : 'التالي';
    bNext.addEventListener('click', function () {
      if (state.currentIndex === state.exam.questions.length - 1) reviewExam();
      else { state.currentIndex++; renderExamQuestion(); }
    });
    els.examActions.appendChild(bNext);
  }

  function renderExamActions() { renderExamQuestion(); }

  function reviewExam() {
    var html = '<h3>مراجعة إجاباتك</h3><div class="course-options">';
    state.exam.questions.forEach(function (q) {
      var ans = state.answers[q.question_id];
      html += '<div class="course-review-row"><strong>' + (state.currentIndex + 1) + '-</strong> ' + esc(q.question) + '<br><em>' + (ans === undefined ? 'لم تُجب' : 'جوابك: ' + esc(q.options[ans])) + '</em></div>';
    });
    html += '</div><div class="course-actions"><button id="course-submit" class="btn-primary">تأكيد الإرسال</button><button id="course-back-review" class="btn-secondary">تعديل</button></div>';
    els.examQ.innerHTML = html;
    els.examActions.innerHTML = '';
    document.getElementById('course-submit').addEventListener('click', submitExam);
    document.getElementById('course-back-review').addEventListener('click', function () { state.currentIndex = 0; renderExamQuestion(); });
  }

  function submitExam() {
    var answers = Object.keys(state.answers).map(function (qid) {
      return { question_id: qid, selected_index: state.answers[qid], response_time_sec: 0 };
    });
    api('/api/course/exam/submit', { method: 'POST', body: { attempt_id: state.exam.attempt_id, answers: answers } })
      .then(function (data) {
        state.snapshot = data.snapshot;
        state.profile = { overall_mastery: data.result.overall_mastery, overall_level: data.result.overall_level, strengths: data.result.strengths, weaknesses: data.result.weaknesses, skills: {} };
        renderResult(data.result);
      })
      .catch(function (err) { setMsg(err.message, true); });
  }

  function renderResult(result) {
    show('course-exam-view', false);
    show('course-lesson-view', false);
    show('course-result-view', true);
    var pass = result.passed;
    var html = '';
    html += '<div class="course-result-box ' + (pass ? 'pass' : 'fail') + '">';
    html += '<h2>' + (pass ? 'ناجح!' : 'لم تنجح بعد') + '</h2>';
    html += '<p class="course-score">الدرجة: ' + result.score + '% (' + result.correct_count + '/' + result.total + ')</p>';
    html += '<p>حدود النجاح: ' + result.pass_score + '%</p>';
    html += '</div>';
    var skillsHtml = Object.keys(result.per_skill || {}).map(function (s) {
      var v = result.per_skill[s];
      return '<div class="course-skill-row"><span>' + esc(s) + '</span><div class="course-progress-bar small"><div class="course-progress-fill" style="width:' + Math.round(v.correct / v.total * 100) + '%"></div></div><span>' + v.correct + '/' + v.total + '</span></div>';
    }).join('');
    html += '<div class="course-box"><h3>أداء المهارات</h3>' + (skillsHtml || '<p>لا توجد بيانات</p>') + '</div>';
    html += '<div class="course-box"><h3>المستوى العام</h3><p><strong>' + esc(result.overall_level) + '</strong> — متوسط الإتقان ' + result.overall_mastery + '%</p></div>';
    if ((result.strengths || []).length) html += '<p class="course-chip-row">نقاط قوة: ' + result.strengths.map(function (s) { return '<span class="chip chip-good">' + esc(s) + '</span>'; }).join(' ') + '</p>';
    if ((result.weaknesses || []).length) html += '<p class="course-chip-row">نقاط ضعف: ' + result.weaknesses.map(function (s) { return '<span class="chip chip-warn">' + esc(s) + '</span>'; }).join(' ') + '</p>';

    html += '<div class="course-actions">';
    html += '<button id="course-result-dash" class="btn-primary">العودة للدورة</button>';
    if (result.exam_type === 'lesson' && result.passed) {
      // استمرارية
    }
    if (!result.passed) {
      html += '<button id="course-result-retry" class="btn-secondary">إعادة الإمتحان</button>';
    }
    html += '</div>';
    els.result.innerHTML = html;

    document.getElementById('course-result-dash').addEventListener('click', function () {
      show('course-result-view', false); show('course-dashboard', true); renderDash();
    });
    var retry = document.getElementById('course-result-retry');
    if (retry) retry.addEventListener('click', function () {
      show('course-result-view', false);
      startExam(result.exam_type, result.exam_type === 'final' ? 'final' : result.ref_id);
    });
    if (result.passed && result.exam_type !== 'final') {
      var nextBtn = document.createElement('button');
      nextBtn.className = 'btn-primary';
      var lesson = findLesson(result.ref_id);
      var snapU = state.snapshot && state.snapshot.units;
      var nextOpen = null;
      (snapU || []).forEach(function (u) { (u.lessons || []).forEach(function (l) {
        if (l.elements && l.elements.some(function (e) { return e.status === 'open'; }) && !nextOpen) nextOpen = l.id;
      }); });
      nextBtn.textContent = lesson && lesson.elements.some(function (e) { return e.status === 'completed'; }) ? 'المتابعة في الدروس' : 'متابعة الدروس';
      nextBtn.addEventListener('click', function () {
        show('course-result-view', false);
        if (nextOpen) openLesson(nextOpen);
        else { show('course-dashboard', true); renderDash(); }
      });
      els.result.appendChild(nextBtn);
    }
  }

  function loadAdapt(elementId) {
    api('/api/course/adapt', { method: 'POST', body: { lesson_id: state.element.lessonId, element_id: elementId } })
      .then(function (data) {
        var body = document.getElementById('course-adapt-body');
        body.classList.remove('hidden');
        body.innerHTML = '<div class="course-box course-adapt-box"><strong>شرح مبسّط</strong><p>' + esc(data.explanation) + '</p>' +
          (data.example ? '<strong>مثال إضافي</strong><p>' + esc(data.example) + '</p>' : '') + '</div>';
      })
      .catch(function (err) { setMsg(err.message, true); });
  }

  function loadProgress() {
    return api('/api/course/progress').then(function (data) {
      state.snapshot = data.snapshot;
      state.profile = data.profile;
      return data;
    });
  }

  function showTab(name) {
    var courseTab = name === 'course';
    show('course-tab', courseTab);
    document.getElementById('tab-course').classList.toggle('active', courseTab);
    document.getElementById('tab-summaries').classList.toggle('active', !courseTab);
    if (courseTab) {
      loadProgress().then(function () {
        renderDash();
        show('course-lesson-view', false);
        show('course-exam-view', false);
        show('course-result-view', false);
        show('course-dashboard', true);
      }).catch(function (err) {
        setMsg(err.message, true);
      });
    }
  }

  function bindTabs() {
    els.tabCourse.addEventListener('click', function () { showTab('course'); });
    els.tabSummaries.addEventListener('click', function () { showTab('summaries'); });
    els.backLesson.addEventListener('click', function () {
      show('course-lesson-view', false); show('course-exam-view', false); show('course-result-view', false);
      show('course-dashboard', true); renderDash();
    });
  }

  function init() {
    bindTabs();
    if (isLoggedIn()) showTab('course');
  }

  function isLoggedIn() {
    return !!(window.AppAuth && window.AppAuth.getSession && window.AppAuth.getSession());
  }

  window.CourseApp = {
    init: init,
    showTab: showTab,
    renderDash: renderDash,
    _state: state
  };
})();
```

- [ ] **Step 3: app.js — ربط التبويبات مع العرض الحالي** — عدّل في `public/app.js` دالة `showView` لتشمل تبويب الدورة، وأضف بعد تهيئة AppAuth نداء `CourseApp.init()`:

في `app.js` حوّل `showView` إلى:
```js
  function showView(view) {
    homeView.classList.toggle('hidden', view === 'reader');
    readerView.classList.toggle('hidden', view === 'home');
    var courseEl = document.getElementById('course-tab');
    if (courseEl) courseEl.classList.toggle('hidden', view !== 'course');
    if (view === 'course' && window.CourseApp) {
      window.CourseApp.showTab('course');
    }
    window.scrollTo(0, 0);
  }
```
ونقاط الاتصال: عند الضغط على تبويب «الدورة التعليمية» في `course.js` تُستدعى `showTab` (يحصل ضمني على التبويبات).
وعند نجاح تسجيل الدخول (بعد `onAuthStateChange`) أضف استدعاء:
```js
    if (window.CourseApp) window.CourseApp.init();
```

> ملاحظة: `course.js` تبني شاشاتها داخل `#course-tab` وحدها ولا تعتمد على `showView`؛ تبويب «الملخصات» يعيد تفعيل `home-view`/`reader-view` كما هي.

- [ ] **Step 4: style.css — أنماط الدورة** — أضِف في نهاية `public/style.css`:

```css
/* ===== الدورة التعليمية ===== */
.tab-nav { display: flex; gap: 8px; padding: 8px 16px; background: var(--surface,#fff); border-bottom: 1px solid var(--border,#e5e7eb); direction: rtl; }
.tab-btn { padding: 8px 18px; border: 1px solid transparent; border-radius: 20px; background: transparent; cursor: pointer; font-weight: 600; color: var(--muted,#6b7280); }
.tab-btn.active { background: var(--accent,#2563eb); color: #fff; border-color: var(--accent,#2563eb); }
.course-inner { max-width: 860px; margin: 0 auto; padding: 16px; }
.course-overall { background: var(--surface,#fff); border: 1px solid var(--border,#e5e7eb); border-radius: 12px; padding: 16px; margin-bottom: 16px; }
.course-progress-bar { background: #e5e7eb; border-radius: 10px; height: 12px; overflow: hidden; }
.course-progress-fill { background: var(--accent,#2563eb); height: 100%; border-radius: 10px; transition: width .4s; }
.course-progress-bar.small { height: 8px; }
.course-overall-label { margin: 8px 0; }
.course-chip-row { margin: 6px 0; line-height: 2; }
.chip { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 13px; margin-inline-end: 4px; }
.chip-good { background: #dcfce7; color: #15803d; }
.chip-warn { background: #fee2e2; color: #b91c1c; }
.course-unit-card { background: var(--surface,#fff); border: 1px solid var(--border,#e5e7eb); border-radius: 12px; padding: 12px; margin-bottom: 12px; }
.course-unit-card.locked { opacity: .55; }
.course-unit-head { display: flex; gap: 10px; align-items: center; }
.course-unit-icon { font-size: 20px; }
.course-lessons { padding: 8px 4px 0 0; }
.course-lesson { display: flex; gap: 10px; align-items: flex-start; padding: 8px; border-radius: 8px; cursor: pointer; }
.course-lesson:hover { background: #f3f4f6; }
.course-lesson.locked { cursor: not-allowed; opacity: .6; }
.course-lesson-icon { font-size: 16px; }
.course-lesson-body { flex: 1; }
.course-elements { margin-top: 4px; }
.course-dot { display: inline-block; margin: 2px 2px 2px 0; padding: 2px 8px; border-radius: 10px; background: #f3f4f6; font-size: 12px; cursor: pointer; }
.course-dot.completed { background: #dcfce7; }
.course-dot.open { background: #dbeafe; }
.course-element-position { color: var(--muted,#6b7280); }
.course-box { background: var(--surface,#fff); border: 1px solid var(--border,#e5e7eb); border-radius: 10px; padding: 12px; margin: 10px 0; }
.course-example { margin-top: 8px; }
.course-actions { display: flex; gap: 10px; margin-top: 14px; flex-wrap: wrap; }
.course-exam-head { margin-bottom: 8px; }
.course-exam-q h3 { margin-bottom: 10px; }
.course-options { display: grid; gap: 8px; }
.course-option { display: flex; gap: 8px; align-items: center; padding: 10px 12px; border: 1px solid var(--border,#e5e7eb); border-radius: 8px; cursor: pointer; }
.course-option.chosen { background: #dbeafe; border-color: var(--accent,#2563eb); }
.course-review-row { padding: 6px 0; border-bottom: 1px dashed var(--border,#e5e7eb); }
.btn-exam { margin-top: 8px; padding: 8px 16px; border-radius: 8px; background: var(--accent,#2563eb); color: #fff; border: none; cursor: pointer; font-weight: 600; }
.btn-unit-exam { margin-top: 10px; }
.btn-final { display: block; margin: 16px auto; padding: 12px 24px; font-size: 16px; }
.course-result-box { border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 16px; }
.course-result-box.pass { background: #dcfce7; }
.course-result-box.fail { background: #fee2e2; }
.course-score { font-size: 20px; font-weight: 700; }
.course-msg { text-align: center; padding: 12px; }
.course-msg.error { color: #b91c1c; }
.course-adapt { margin: 10px 0; }
.course-adapt-box { background: #fef9c3; }
```

- [ ] **Step 5: فحص تحميل المحتوى في المتصفح**
  1. شغّل `node server.js` وافتح `http://localhost:5500`.
  2. سجّل الدخول بحساب تجريبي.
  3. اضغط تبويب «الدورة التعليمية»: تظهر الوحدة الأولى مفتوحة والباقي مقفلة، وشريط التقدم فارغ.
  4. افتح الدرس الأول → العنصر الأول (شرح + مثال) → زر «التالي» يعمل → بعد آخر عنصر يظهر «إلى إمتحان الدرس».
  5. أجب عن أسئلة الإمتحان → «مراجعة وإرسال» → شاشة النتيجة بدرجة ومهارات (قوة/ضعف).

- [ ] **Step 6: Commit**

```bash
git add public/index.html public/course.js public/style.css public/app.js
git commit -m "feat: واجهة الدورة التعليمية (تبويبات، لوحة، درس، امتحان، نتيجة)"
```

---

### Task 6: سكربت الإختبار الشامل (smoke) والتكامل مع المدرّس الذكي

**Files:**
- Create: `scripts/smoke-course.js`
- Modify: `api/chat.js`

**Interfaces:**
- Consumes: مسارات API من Task 4 (عبر HTTP) ``، `window` غير مستخدم.
- Produces: `node scripts/smoke-course.js` (تحقق بنيوي + تدفق كامل عبر HTTP مع مستخدم تجريبي)؛ وقراءة `get_student_course_context` في سياق المدرّس الذكي.

- [ ] **Step 1: smoke — التحقق البنيوي والتدفق الكامل** — أنشئ `scripts/smoke-course.js`:

```js
// smoke-course.js — تحقق بنيوي من المحتوى + تدفق HTTP كامل عبر مسارات API (مع مستخدم تجريبي).
// الاستخدام:
//   node scripts/smoke-course.js            # تحقق بنيوي فقط
//   node scripts/smoke-course.js --flow=http://localhost:5500  # + تدفق كامل (يلزم تشغيل node server.js)
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
const BASE = process.argv.find((a) => a.startsWith('--flow='));
const BASE_URL = BASE ? BASE.split('=')[1] : null;

// ===== 1) التحقق البنيوي =====
const course = require('../public/course/course.json');
const bank = require('../public/course/questions.json');
const skills = require('../public/course/skills.json');

const seenQ = new Set();
let checked = 0;
for (const u of course.units) {
  for (const l of u.lessons) {
    assert(l.elements && l.elements.length >= 1, 'درس بلا عناصر: ' + l.id);
    for (const e of l.elements) {
      const qs = bank.questions.filter((q) => q.element_id === e.id);
      assert(qs.length >= 1, 'عنصر بلا أسئلة: ' + e.id);
      for (const q of qs) {
        assert(!seenQ.has(q.id), 'تكرار سؤال: ' + q.id); seenQ.add(q.id);
        assert(q.options.length === 4, 'خيارات غير 4: ' + q.id);
        assert(Number.isInteger(q.correct_index) && q.correct_index >= 0 && q.correct_index <= 3, 'correct_index خاطئ: ' + q.id);
        checked++;
      }
    }
  }
}
assert(skills.version === 1, 'skills.json version');
console.log('smoke: binary OK — ' + checked + ' questions checked');

// ===== 2) التحقق من عدم تسريب الإجابة (فحص الحقول) =====
const sample = bank.questions[0];
assert(!('correct_answer' in sample) && !('correct_option' in sample), 'صيغة إجابة غير متوقعة');
assert('correct_index' in sample, 'correct_index مفقود');

if (!BASE_URL) {
  console.log('smoke: structure OK (flow skipped — add --flow=http://localhost:5500)');
  process.exit(0);
}

// ===== 3) التدفق الكامل عبر HTTP =====
const crypto = require('crypto');
function post(url, body, token) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token ? 'Bearer ' + token : '' },
    body: JSON.stringify(body)
  }).then(async (r) => ({ status: r.status, body: await r.json() }));
}
function get(url, token) {
  return fetch(url, { headers: { Authorization: token ? 'Bearer ' + token : '' } })
    .then(async (r) => ({ status: r.status, body: await r.json() }));
}

async function flow() {
  const email = 'smoke-' + crypto.randomBytes(4).toString('hex') + '@example.com';
  const password = 'SmokeTest!2026';

  let r = await post(BASE_URL + '/api/config', {});
  const cfg = r.status === 200 ? r.body : await fetch(BASE_URL + '/api/config').then((x) => x.json());
  // إنشاء حساب عبر Supabase Auth (تشبه auth.js)
  const { createClient } = require('@supabase/supabase-js');
  const sb = createClient(cfg.url, cfg.anonKey, { auth: { persistSession: false } });
  await sb.auth.signUp({ email, password });
  const signin = await sb.auth.signInWithPassword({ email, password });
  if (!signin.data || !signin.data.session) throw new Error('تعذر دخول مستخدم smoke');

  const token = signin.data.session.access_token;
  const headers = { Authorization: 'Bearer ' + token };

  // أ) الحالة الأولية
  r = await get(BASE_URL + '/api/course/progress', token);
  assert(r.status === 200, 'GET progress 200');
  const snap0 = r.body.snapshot;
  const firstUnit = snap0.units[0];
  const firstLesson = firstUnit.lessons[0];
  const firstEl = firstLesson.elements[0];
  assert(firstEl.status === 'open', 'أول عنصر مفتوح');
  assert(snap0.units[1].status === 'locked', 'الوحدة الثانية مقفولة');

  // ب) إكمال كل عناصر الدرس الأول
  for (const e of firstLesson.elements) {
    r = await post(BASE_URL + '/api/course/progress', { ref_type: 'element', ref_id: e.id }, token);
    assert(r.status === 200, 'إكمال عنصر ' + e.id);
  }
  r = await get(BASE_URL + '/api/course/progress', token);
  assert(r.body.snapshot.units[0].lessons[0].exam.status === 'available', 'إمتحان الدرس متاح');

  // ج) توليد امتحان وإرساله بالكامل صحيحاً
  r = await get(BASE_URL + '/api/course/exam?type=lesson&ref=' + firstLesson.id, token);
  assert(r.status === 200, 'tولid الامتحان 200');
  const exam = r.body;
  assert(exam.questions.length >= 1, 'أسئلة الامتحان');
  const answers = [];
  for (const q of exam.questions) {
    const full = bank.questions.find((x) => x.id === q.question_id);
    answers.push({ question_id: q.question_id, selected_index: full.correct_index, response_time_sec: 2 });
  }
  r = await post(BASE_URL + '/api/course/exam/submit', { attempt_id: exam.attempt_id, answers }, token);
  assert(r.status === 200, 'submit 200');
  assert(r.body.result.passed === true, 'ناجح بعد كل الإجابات الصحيحة');
  assert(r.body.result.score === 100, 'درجة 100');

  // د) فتح أول عنصر من الدرس الثاني
  const secondLesson = firstUnit.lessons[1];
  const snapAfter = r.body.snapshot;
  const secondFirst = secondLesson && snapAfter.units[0].lessons[1].elements[0];
  if (secondFirst) assert(secondFirst.status === 'open', 'الدرس التالي مفتوح بعد نجاح الإمتحان');

  // هـ) محاولة اختراق: إكمال عنصر في وحدة مقفولة يرفض
  const lockedEl = snapAfter.units[1].lessons[0].elements[0];
  r = await post(BASE_URL + '/api/course/progress', { ref_type: 'element', ref_id: lockedEl.id }, token);
  assert(r.status === 403, 'عنصر في وحدة مقفولة يُرفض (403)');

  console.log('smoke: FLOW OK — كامل المسار يعمل end-to-end');
}

flow().catch((err) => { console.error('smoke FLOW FAILED:', err.message); process.exit(1); });
```

- [ ] **Step 2: تشغيل smoke المحلي**

Run (نافذة أولى):
```powershell
node server.js
```
Run (نافذة ثانية):
```powershell
node scripts/smoke-course.js --flow=http://localhost:5500
```
Expected: `smoke: binary OK — 83 questions checked` ثم `smoke: FLOW OK — كامل المسار يعمل end-to-end`

- [ ] **Step 3: دمج سياق الدورة في المدرّس الذكي** — عدّل `api/chat.js`:

أضف بعد دالة `getAcademicContext` دالة جديدة:
```js
async function getCourseContext(auth) {
  const { url, anonKey } = getSupabaseConfig();
  try {
    const res = await fetch(url + '/rest/v1/rpc/get_student_course_context', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: 'Bearer ' + auth.token
      },
      body: '{}'
    });
    if (!res.ok) return null;
    let data = await res.json();
    if (Array.isArray(data)) data = data[0];
    if (!data || typeof data !== 'object') return null;
    return data;
  } catch (err) {
    console.warn('get_student_course_context unavailable:', err && err.message);
    return null;
  }
}
```

وفي `handleChat` بعد `const academic = await getAcademicContext(auth);`:
```js
  const courseCtx = await getCourseContext(auth);
  const courseSection = courseCtx
    ? '## ملف تقدم الدورة التعليمية (course)\n' + JSON.stringify(courseCtx, null, 2)
    : '';
```
وأضف `courseSection` في بناء `systemContent` بعد `academicSection`، مع توجيه قصير:
```js
  const courseInstruction = courseCtx
    ? '\nإن ورد سؤال ضمن الدورة التعليمية فوجّه الطالب نحو ضعف المهارات في ملف الدورة أعلاه بلطف.'
    : '';
```
والصق `courseInstruction` في نهاية `systemContent`.

- [ ] **Step 4: فحص chat سياق الدورة**
Run:
```powershell
node server.js
```
ثم أرسل رسالة عبر `/api/chat` (يمكن الاختبار يدوياً من نافذة المتصفح) وتأكد من عمل الدردشة دون كسر — يحتاج حساباً مسجل الدخول.

- [ ] **Step 5: Commit**

```bash
git add scripts/smoke-course.js api/chat.js
git commit -m "feat: smoke شامل للدورة وتكامل سياق الدورة مع المدرّس الذكي"
```

---

### Task 7: التوثيق والمعايرة النهائية

**Files:**
- Create: `docs/course-platform.md`
- Modify: `README.md` (إن وُجد)

**Interfaces:**
- Consumes: كل ما سبق.
- Produces: دليل استخدام للطالب وأسماء ملفات للصيانة.

- [ ] **Step 1: دليل استخدام مختصر** — أنشئ `docs/course-platform.md` بالعربية، يشرح:
  1. التبويب الجديد «الدورة التعليمية» وسير المسار (وحدات ← دروس ← عناصر ← إمتحانات).
  2. قواعد التتابع الإجباري والعتبات (درس 60%، وحدة 50%، شمولية).
  3. كيف تُستعمل نقاط القوة/الضعف (بطاقة «اشرح لي بطريقة أبسط» + تدرّج صعوبة الأسئلة).
  4. إعادة البناء: `node scripts/build-course-content.js` ثم `node scripts/smoke-course.js`.
  5. جداول Supabase الجديدة وإضافة أسئلة (كل عنصر يحتاج سؤالاً واحداً على الأقل).

- [ ] **Step 2: تحقق نهائي شامل**

Run:
```powershell
node scripts/test-engine.js
node scripts/smoke-course.js
```
ثم شغّل `node server.js` وافحص يدوياً التدفق 1→6 من المواصفة مع مستخدم تجريبي (لوحة → درس → عناصر → إمتحان → وحدة → نهائي) على فرع اختبار.

- [ ] **Step 3: Commit**

```bash
git add docs/course-platform.md README.md
git commit -m "docs: توثيق نظام الدورة التعليمية والتعلّم التكيّفي"
```

---

## Self-Review (فحص خطة)

- تغطية المواصفات: قسم 1 (الهدف) ← Global Constraints. قسم 2 (النطاق) ← تُركت التشخيصات محفوظة، «البرنامج السنوي» خارج الدورة. قسم 3 (البنية) ← Tasks 3-5. قسم 4 (نموذج المحتوى) ← Task 2. قسم 5 (بناء) ← Task 2 + العناية بـ smoke. قسم 6 (تتابع) ← `sequence.js` (Task 3). قسم 7 (امتحانات) ← `exam-gen.js`. قسم 8 (تصحيح/ملف الطالب) ← `scoring.js` + `helpers.js`. قسم 9 (التكيّف) ← `adapt.js` + صعوبة الأسئلة في `exam-gen.js`. قسم 10 (واجهة) ← Task 5. قسم 11 (تدفق الطالب) ← smoke http (Task 6) + فحص يدوي. قسم 12 (أخطاء) ← 401s من `requireUser`، fallback في `adapt.js`، صيد أخطاء في كل handler. قسم 13 (اختبار) ← `test-engine.js` + `smoke-course.js`. قسم 14 (ملفات) ← Task files. قسم 15 (أمان) ← RLS مكتوب في Task 1 + إصلاح `migrations_log`.

- حالات متصلة:
  - `exam-gen.خر` `fill()` يستخدم `priorityScore(a, {})` — معلمات موثقة؛ لا أثر جانباً خطيراً.
  - `smoke-course.js` يتطلب تشغيل الخادم و`@supabase/supabase-js` (موجود في dependencies).
  - عتبة `unit` في `examThreshold` = 50 في حين `pass_score` لأي `final` = 60 ثابتة (لا تُستخدم فعلياً).

- **مخاطر مضبوطة:** بنك الوحدات 2-4 أُكمل بـ 40 سؤالاً مُؤلَّفاً؛ إمتحانات بعض الدروس قد تصغر عن 5 أسئلة بصفة مؤقتة في حضور عناصر قليلة — لا يمنع الفتح، والبنك يقبل النمو لاحقاً.