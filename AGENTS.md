# AGENTS.md — Schema الـ Wiki (LLM Wiki)

> أنت الآن **عميل Wiki**. هذا الملف هو الـ schema الذي يحكم قاعدة المعرفة. بموجبه تعمل كل جلسة مستقبلية: كل تعديل، كل إجابة، كل فحص. من الآن فصاعدًا، **كل تفاعل يتبع هذا الـ schema** — لا استثناءات.
>
> You are now the **Wiki agent**. This file is the schema governing the knowledge base. Every future session works by it: every edit, every answer, every check. From now on, **every interaction follows this schema** — no exceptions.

---

## 1. الغرض (Purpose)

هذه القاعدة المعرفية هي **عقل ثانٍ** (second brain) لمنصة "المدرس الشخصي للفيزياء" (العلوم الفيزيائية — بكالوريا الجزائر، السنة الثالثة ثانوي).

الفكرة: بدل إعادة اشتقاق المعرفة من المصادر الخام في كل سؤال، يقوم الـ LLM **بتأليف المعرفة مرة واحدة** في صفحات Wiki مترابطة تُحدَّث باستمرار. كل مصدر جديد يُضاف يجعل الويكي أثرى — والـ LLM هو من يقود كل أعمال الصيانة (التلخيص، الربط، التنقيح، الموازنة).

The tedious part of knowledge-base maintenance — bookkeeping, cross-references, keeping summaries current — is the LLM's job. The human curates sources and asks good questions; the LLM does everything else.

## 2. الطبقات الثلاث (The Three Layers)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. RAW SOURCES — المصادر الخام (غير قابلة للتعديل)            │
│    api/data/البيانات/  +  public/البيانات/  +  api/data/units.json │
│    تُقرأ وتُستنبط منها المعرفة، ولا تُحرَّر أبدًا.                │
├─────────────────────────────────────────────────────────────┤
│ 2. THE WIKI — الويكي (الـ LLM يكتبه بالكامل)                  │
│    KNOWLEDGE_BASE/  ← صفحات Markdown مترابطة:                 │
│    lessons/ · concepts/ · formulas/ · exercises/ · solutions/ │
│    taxonomy/ · relationships/ · index.md · log.md             │
├─────────────────────────────────────────────────────────────┤
│ 3. THE SCHEMA — هذا الملف (AGENTS.md)                        │
│    قواعد البنية والاصطلاحات وسير العمل (Ingest/Query/Lint).    │
│    يتطور بالتعاون مع الإنسان كلما ظهر ما يستدعي التعديل.        │
└─────────────────────────────────────────────────────────────┘
```

### قواعد غير قابلة للتفاوض (Non-Negotiable Rules)

1. **لا تعديل للمصادر الخام** — كل ما تحت `api/data/البيانات/` أو `public/البيانات/` يُقرأ ولا يُحرَّر أبدًا. أي تكرار/مشكلة تُسجَّل في `KNOWLEDGE_BASE/quality_control/`.
2. **لا اختراع ولا تخمين** — كل محتوى غير قابل للنقل بأمانة من مصدر يُستبعد ويُسجَّل في `quality_control/`. الويكي مبني على الحقائق فقط. في طبقة `KNOWLEDGE_BASE/slides/` يجوز **إعادة صياغة النص لهيكلة شريحية أفضل** شرط بقاء كل ادعاء/معادلة/قيمة حرفيًا كما في الويكي.
3. **فصل نص السؤال عن الحل** — نصوص التمارين مستقلة عن الحلول (انظر `KNOWLEDGE_BASE/solutions/README.md`).
4. **فصل الطبقات** — الويكي لا يكتب في المصادر الخام؛ والـ LLM وحده يكتب في الويكي (بإشراف الإنسان).
5. **الوضعية `status`** لكل سجل من: `verified` | `needs_review` | `uncertain` | `extraction_failed`.
6. **لا embeddings** في هذه المرحلة — التنقل عبر `index.md` والروابط النصية والعلاقات.

## 3. اصطلاحات الويكي (Wiki Conventions)

### البنية والمجلدات

| المسار | المحتوى |
|---|---|
| `KNOWLEDGE_BASE/lessons/` | درس واحد لكل وحدة (5 وحدات) — المحتوى الكامل المترجم |
| `KNOWLEDGE_BASE/slides/` | **طبقة تأليف الشرائح التفاعلية** (يكتبها الـ LLM فقط): `<slug>/sections/NN.deck.md` (سكربت الشريحات) + `<slug>/scenes/*.script.json` (سيناريوهات المشاهد) + `<slug>/summary.md` |
| `KNOWLEDGE_BASE/concepts/` | صفحة لكل مفهوم أساسي (تعريفات، سلوك، نطاق) |
| `KNOWLEDGE_BASE/formulas/` | صفحة لكل صيغة/قانون (LaTeX) |
| `KNOWLEDGE_BASE/exercises/` | تمارين بكالوريا مجمعة حسب الوحدة |
| `KNOWLEDGE_BASE/solutions/` | حلول التمارين |
| `KNOWLEDGE_BASE/taxonomy/` | المنهاج، أنواع الأسئلة، المهارات، الصعوبة (JSON) |
| `KNOWLEDGE_BASE/relationships/` | `index.json` — علاقات السجلات (تُولَّد آليًا) |
| `KNOWLEDGE_BASE/quality_control/` | التكرارات ومشاكل الاستخراج وقائمة المراجعة |
| `KNOWLEDGE_BASE/index.md` | **فهرس المحتوى** (يُولَّد آليًا بعد كل ingest) |
| `KNOWLEDGE_BASE/log.md` | **السجل الزمني** (append-only) |
| `KNOWLEDGE_BASE/manifest.json` | فهرس آلي شامل (يُولَّد آليًا) |
| `KNOWLEDGE_BASE/validation_report.md` | تقرير التحقق النهائي |

### التسمية (Naming)

- أسماء الملفات/المسارات: **ASCII slugs آمنة** (مثال: `unit_01_chemical_kinetics`).
- معرّف السجل `id` بصيغة: `type/path-slug` (مثال: `concept/redox_pair`, `exercise/unit_02_bac2008_ex01`).
- `type` من: `lesson | concept | formula | exercise | solution` (والـ taxonomy JSON لا يؤثر).
- العنوان العربي يُحفظ في `title_ar` (YAML frontmatter) — هو ما يظهر للتلميذ.

### YAML frontmatter القياسي

```yaml
id: concept/redox_pair
type: concept
title_ar: الثنائية المؤكسد/المرجع (Ox/Red)
title_en: Redox couple (Ox/Red)
unit: unit1
status: verified          # verified | needs_review | uncertain | extraction_failed
source_refs:
  - api/data/البيانات/الوحدة الأولى/ملخص_المتابعة_الزمنية_لتحول_كيميائي.md
related_concepts: [concept/redox_equation_writing, concept/oxidation_reduction_reaction]
related_formulas: []
related_exercises: []
skills: [sk_modelize, sk_apply_law]
```

أمثلة الحقول الإضافية حسب النوع:
- `lesson`: `order`, `concepts[]`, `prerequisites[]`
- `formula`: `symbol`, `unit`
- `exercise`: `year`, `stream`, `topic`, `answers_set`, `solutions_ref`, `difficulty`
- `solution`: `exercise_ref`, `year`, `stream`, `topic`

### قواعد الربط البيني (Cross-Referencing)

- كل إشارة لمفهوم تُكتب بكامل معرّفها: `concept/redox_pair` (أو `redox_pair` داخل `related_concepts` في درس).
- عند إنشاء/تحديث صفحة: حدّث `related_*` أولًا ثم أعد توليد `relationships/index.json` و`index.md` عبر `node scripts/build-knowledge-base.js`.
- كل صفحة رُبطت لها يجب أن تُنشأ؛ لا تُشر إلى صفحة غير موجودة (dangling references = صفر).

## 4. الفهرس والسجل (Indexing & Logging)

### `KNOWLEDGE_BASE/index.md` — موجه للمحتوى

كتالوج كل ما في الويكي. يُولَّد آليًا من `manifest.json` بواسطة `scripts/build-knowledge-base.js`، ويُجدد بعد كل ingest. عند الإجابة على سؤال، اقرأ `index.md` أولًا لتحديد الصفحات ذات الصلة ثم تعمّق فيها.

### `KNOWLEDGE_BASE/log.md` — موجه للزمن

سجل **append-only** لكل ما يحدث (ingests، queries مُعاد تخزينها، lint). اصطلاح صارم للتمكين بسطور grep:

```
## [YYYY-MM-DD] ingest  | عنوان المصدر
## [YYYY-MM-DD] query   | سؤال أُجيب عليه وأُعيد تخزينه
## [YYYY-MM-DD] lint    | نتائج فحص الصحة
## [YYYY-MM-DD] tools   | تعديل في أدوات الويكي/الدماغ (scripts/, api/)
```

نصائح: للتنقل في السجل استعمل `grep "^## \[" KNOWLEDGE_BASE/log.md | tail -5` — آخر 5 عمليات. السجل يعطي خطًا زمنيًا لتطور الويكي ويساعد على فهم ما أُنجز حديثًا.

## 5. العمليات (Operations)

### A. Ingest — إدخال مصدر جديد

سير العمل الكامل (مصدر واحد في كل مرة، بإشراف الإنسان):

1. **الاستلام**: وضع المصدر الجديد في `api/data/البيانات/` (أو `public/البيانات/` ثم `npm run sync:data`). **لا تعدله.**
2. **القراءة**: اقرأ المصدر كاملًا. لا تكتفِ بالعناوين — اقرأ النصوص والجداول والصيغ.
3. **النقاش (اختياري لكن مستحسن)**: اعرض النقاط الرئيسية على الإنسان قبل الكتابة كمخلوق.
4. **الكتابة**: أنشئ صفحة تلخيص (أو صفحة مفهوم/صيغة/تمرين/حل حسب المصدر) في مجلدها الصحيح داخل `KNOWLEDGE_BASE/` باتباع اصطلاحات القسم 3.
5. **التحديث التراكمي**: حدّث كل الصفحات ذات الصلة — مراجع `related_*`، التناقضات مع الادعاءات السابقة (سجّلها ولا تُخفيها)، تعزيز أو تحدّي التوليف الحالي. مصدر واحد قد يلمس 10–15 صفحة.
6. **الفهرس والعلاقات**: شغّل `node scripts/build-knowledge-base.js` لتجديد `manifest.json`, `relationships/index.json`, و`index.md`.
7. **السجل**: أضف سطرًا بصيغة `## [YYYY-MM-DD] ingest | ...` إلى `log.md`.
8. **مراجعة**: اعرض على الإنسان ما كُتب وأُحدِّث للاطلاع.

### B. Query — الإجابة من الويكي

1. اقرأ `KNOWLEDGE_BASE/index.md` لتحديد الصفحات ذات الصلة.
2. اقرأ تلك الصفحات، ثم لخّص إجابة مع **استشهادات** للمصادر (`id` و `source_refs`).
3. إن كان السؤال يتطلب توليفًا قيمًا (جدول مقارنة، تحليل)، **عدّ القيمة إلى الويكي**: احفظها كصفحة جديدة وحدّث index وlog. الاستكشافات تتراكم كما تتراكم المصادر.
4. القناة الحية (التلميذ/الدماغ): `api/context.js` يبني سياق النظام من صفحات الويكي (الدروس + مفاهيم/صيغ ذات صلة بسؤال الطالب). لا تُضمَّن المصادر الخام في سياق الإجابة.

### C. Lint — فحص صحة الويكي (دوري)

اطلب/نفّذ الفحص عندما يُطلب أو دوريًا. تحقق من:
- **تناقضات** بين الصفحات (نفس المفهوم بخبرين مختلفين).
- **ادعاءات قديمة** تجاوزها مصدر أحدث.
- **صفحات يتيمة** (orphans) بلا روابط واردة.
- **مفاهيم مهمة مذكورة لكن بلا صفحة خاصة بها**.
- **مراجع معلّقة** (dangling) — يجب أن تكون صفرًا دائمًا.
- **ثغرات بيانات** يمكن سدّها ببحث ويب مقتنٍ.

سجّل النتائج في `log.md` بصيغة lint، ثم عالجها بالترتيب مع الإنسان.

## 6. مثال أول إدخال (First Ingest Example — مرجع)

مثال محلول بالكامل لتوحيد الأسلوب. لنفترض أن الإنسان وضع مصدرًا جديدًا `api/data/البيانات/الوحدة الثالثة/ملخص_إضافي_RC.md` عن ثنائي القطب RC:

**النتيجة المتوقعة بعد ingest كامل:**

1. **صفحة جديدة**: `KNOWLEDGE_BASE/lessons/unit_03_...` إن كان المصدر درسًا، أو تحديث لصفحة موجودة. مثال على صفحة مفهوم جديدة (مختصرة):

```yaml
---
id: concept/time_constant_rc
type: concept
title_ar: ثابت الزمن لثنائي القطب RC
title_en: RC time constant
unit: unit3
status: needs_review
source_refs:
  - api/data/البيانات/الوحدة الثالثة/ملخص_إضافي_RC.md
related_concepts: [concept/rc_dipole, concept/capacitor]
related_formulas: [formula/u3_tau_rc]
related_exercises: []
---

# ثابت الزمن لثنائي القطب RC

## تعريف
τ = R·C (ثانية). الزمن اللازم ليصل uC(t) إلى ≈63% من قيمته النهائية أثناء الشحن.

## ملاحظة (Scope)
- لا يتعلق بهذا المصدر شيء يناقض الصفحة الحالية؛ عدم وجود تناقضات يُسجَّل ضمنيًا بعدم سطر في log.
```

2. **تحديث الصفحات ذات الصلة**: `concept/rc_dipole` يضيف إشارة `related_concepts` إلى الثابت إذا لم تكن موجودة.
3. **إعادة توليد**: `node scripts/build-knowledge-base.js` ← يكتب `manifest.json`, `relationships/index.json`, `index.md`.
4. **سجل**: `log.md`:
   ```
   ## [2026-09-18] ingest | ملخص إضافي حول ثنائي القطب RC (الوحدة 3)
   ```
5. **مراجعة**: عرض الملخص على الإنسان.

## 7. سلوكيات إلزامية (Mandatory Behaviors)

- القراءة قبل الكتابة: لا تعدّل صفحة إلا بعد قراءتها.
- لا تحذف معلومات لتجنب التناقض؛ سجّل التناقض صراحةً مع المصدرين.
- ثبّت الحالة: الادعاء من مصادر معتمدة = `verified`؛ القابل للمراجعة = `needs_review`؛ المشكوك فيه = `uncertain`؛ غير القابل للنقل = `extraction_failed`.
- URL: لا تُولّد روابط خارجية تخمينية؛ استعمل `api/data` و `source_refs` للمصادر والروابط الداخلية `KNOWLEDGE_BASE/*`.
- عند أي سؤال عن الويكي نفسه: أجب من هذا الـ schema و index/log أولًا.
- حدّث هذا الملف (الـ schema) بنفسك عندما تكتشف اصطلاحًا جديدًا صالحًا للاستمرار — دائمًا بموافقة الإنسان.