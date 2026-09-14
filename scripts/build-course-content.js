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