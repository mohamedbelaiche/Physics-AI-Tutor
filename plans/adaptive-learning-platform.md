# Plan: Adaptive Physics Learning Platform

**Status**: Active  
**Branch**: main

## Audit Summary

### Current Architecture
- **Frontend**: Vanilla JS SPA (no framework), RTL Arabic, pdf.js viewer, chat panel
- **Backend**: Node.js `http` server (local) + Vercel serverless (`api/*.js`)
- **Database**: Supabase Postgres with RLS, 12 tables already exist
- **AI**: OpenRouter → GPT-4o-mini, single `/api/chat` endpoint
- **Content**: PDFs in `public/البيانات/`, markdown in `api/data/`, structured KB in `KNOWLEDGE_BASE/`

### Existing DB Tables (can reuse/extend)
| Table | Status | Reuse Plan |
|---|---|---|
| `profiles` | ✅ Active | Keep as-is |
| `chat_sessions` | ✅ Active | Keep as-is |
| `chat_messages` | ✅ Active | Keep as-is |
| `user_progress` | ⚠️ Minimal (only "opened") | Extend with completion tracking |
| `diagnostic_skill_defs` | ✅ 16 skills | Extend with lesson-specific skills |
| `student_skill_profiles` | ✅ 34 rows | Add confidence, recent_performance |
| `student_diagnostic_profiles` | ✅ 3 profiles | Extend to full learning profile |
| `diagnostic_questions` | ✅ 90 questions | Template for question bank |
| `diagnostic_attempts` | ✅ 7 attempts | Template for assessment attempts |
| `diagnostic_answers` | ✅ 170 answers | Template for answer tracking |
| `diagnostic_tests` | ✅ 2 tests | Template for assessments |

### Dead Code
- `api/chat.js` calls `get_student_diagnostic_context` RPC (function exists but frontend code that uses it was deleted)
- `ACADEMIC_INSTRUCTION` references `skill_map` and `recommended_start` (dormant)

## Implementation Plan (12 Phases)

### Phase 1: Content Data Structure
**Goal**: Define course → unit → lesson → section structure in JSON

**Files to create**:
- `public/course.json` — Full course tree with lessons, sections, skills per section
- `KNOWLEDGE_BASE/taxonomy/lesson_skills.json` — Mapping: lesson → skills → questions

**Files to modify**: None (additive)

### Phase 2: DB Schema Extension
**Goal**: Add tables for adaptive learning without breaking existing ones

**New migration** (`supabase/migrations/012_adaptive_learning_schema.sql`):
- `learning_events` — Event log for analytics
- Extend `student_skill_profiles` with confidence, last_n_results
- `question_bank` — Reusable question bank (separate from diagnostic)
- `assessment_attempts` — Generic assessment attempts (micro quiz, lesson, unit)
- `assessment_answers` — Generic answer tracking
- `student_learning_profile` — Extended profile with adaptive path

### Phase 3: API Routes
**Goal**: Backend endpoints for quiz/progress/skills

**New files**:
- `api/quiz.js` — POST /api/quiz (get questions, submit answers)
- `api/progress.js` — GET/POST /api/progress (read/update progress)
- `api/skills.js` — GET /api/skills (skill mastery)
- `api/adaptive.js` — POST /api/adaptive (get next learning action)

### Phase 4: Skill Mastery Engine
**Goal**: Calculate skill mastery from answer history

**Implementation**: Pure function in `api/engine/skill-mastery.js`
- Bayesian-inspired update
- Confidence based on sample size
- Recency weighting
- Difficulty weighting

### Phase 5: Adaptive Learning Engine
**Goal**: Determine next learning action based on student state

**Implementation**: `api/engine/adaptive-path.js`
- Rule engine + AI fallback
- States: continue, review, simplify, extra_example, prerequisite, advance
- Path per student (non-linear)

### Phase 6: Micro Quiz UI
**Goal**: Inline QCM after each lesson section

**Frontend**: `public/quiz.js` + quiz styles in `style.css`
- Single question view
- Immediate feedback (formative mode)
- Score tracking

### Phase 7: Lesson Assessment
**Goal**: End-of-lesson QCM (8-15 questions)

**Reuse**: Same quiz engine, different parameters
- Multiple difficulty levels
- Skill coverage validation
- Post-assessment analysis

### Phase 8: Unit Assessment  
**Goal**: End-of-unit advanced QCM

**Reuse**: Same quiz engine, harder questions
- Cross-skill questions
- Analysis and recommendations

### Phase 9: Student Dashboard
**Goal**: Overview of progress, skills, recommendations

**Frontend**: New dashboard view in `index.html`
- Progress bars
- Skill map
- Recommendations
- History

### Phase 10: AI Tutor
**Goal**: Context-aware AI within lessons

**Backend**: Extend `api/chat.js` with lesson context
**Frontend**: Tutor panel within lesson view

### Phase 11: AI + Student Data Integration
**Goal**: AI uses student mastery data

**Backend**: Build contextual prompts from student profile

### Phase 12: Testing & UX
**Goal**: Verify everything works

## Execution Order
1. Phase 1 (content structure) → Foundation
2. Phase 2 (DB schema) → Data layer
3. Phase 3 (API routes) → Backend layer  
4. Phase 4 (skill mastery) → Engine logic
5. Phase 5 (adaptive path) → Engine logic
6. Phase 6 (micro quiz UI) → Frontend
7. Phase 7 (lesson assessment) → Frontend + engine
8. Phase 8 (unit assessment) → Frontend + engine
9. Phase 9 (dashboard) → Frontend
10. Phase 10 (AI tutor) → Backend + frontend
11. Phase 11 (AI integration) → Backend
12. Phase 12 (testing) → QA
