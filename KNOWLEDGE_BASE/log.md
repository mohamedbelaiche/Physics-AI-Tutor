# السجل الزمني لقاعدة المعرفة (log — append-only)

> اصطلاح صارم: كل سطر يبدأ بـ `## [YYYY-MM-DD] <op> | <الوصف>`.
> التنقّل: `grep "^## \[" KNOWLEDGE_BASE/log.md | tail -5`.

## [2026-09-18] ingest | تأسيس نمط LLM Wiki: ملف الـ schema (AGENTS.md) وقواعد الطبقات الثلاث والعمليات (Ingest/Query/Lint)
## [2026-09-18] ingest | توليد أول فهرس محتوى `KNOWLEDGE_BASE/index.md` آليًا من `manifest.json` (271 سجلًا — دروس 5، مفاهيم 34، صيغ 36، تمارين 117، حلول 79)
## [2026-09-18] tools | توجيه الدماغ إلى الويكي: إعادة بناء `api/context.js` ليقرأ من صفحات KNOWLEDGE_BASE (دروس + مفاهيم/صيغ مُختارة حسب السؤال) بدل المصادر الخام، وتمرير نص السؤال من `api/chat.js`