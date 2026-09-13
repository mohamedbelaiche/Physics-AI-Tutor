// Server-side loader for course structure / skills / question bank.
// Prefers the live files in public/course (local dev), falls back to mirrored
// copies in api/data (Vercel serverless bundles don't include public/ by default).

const fs = require('fs');
const path = require('path');

const CANDIDATE_ROOTS = [
  path.join(__dirname, '..', '..', 'public', 'course'),
  path.join(__dirname, '..', 'data')
];

const USAGE = {};

function resolveFile(name) {
  if (!USAGE[name]) {
    for (const root of CANDIDATE_ROOTS) {
      const p = path.join(root, name);
      try {
        if (fs.statSync(p).isFile()) {
          USAGE[name] = p;
          break;
        }
      } catch (err) {
        // continue
      }
    }
  }
  return USAGE[name];
}

function loadJson(name, fallback) {
  const p = resolveFile(name);
  if (!p) return fallback;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (err) {
    return fallback;
  }
}

function getCourse() {
  const data = loadJson('course.json', null);
  return data || loadJson('course.json', { units: [] });
}

function getSkills() {
  const data = loadJson('skills.json', null);
  if (data && data.skills) return data;
  const legacy = loadJson('skills.json', { skills: [] });
  return legacy;
}

function getQuestionBank() {
  const data = loadJson('questions.json', null);
  if (Array.isArray(data)) return data;
  return (data && data.questions) || [];
}

// Build a { skillId: [prereqIds] } map from skills.json (prerequisites field).
function getPrerequisiteMap() {
  const map = {};
  const skills = getSkills();
  for (const skill of (skills && skills.skills) || []) {
    const prereqs = Array.isArray(skill.prerequisites) ? skill.prerequisites : [];
    if (prereqs.length) map[skill.id] = prereqs;
  }
  return map;
}

// Enrich each question with the correct_index/explanation already present in the
// bank. Returns { byId, }, id -> question.
function buildQuestionIndex() {
  const bank = getQuestionBank();
  const byId = {};
  for (const q of bank) {
    if (q && q.id) byId[q.id] = q;
  }
  return byId;
}

module.exports = {
  getCourse,
  getSkills,
  getQuestionBank,
  getPrerequisiteMap,
  buildQuestionIndex
};