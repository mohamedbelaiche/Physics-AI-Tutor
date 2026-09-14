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