'use strict';
/**
 * scripts/context-bac-exams.test.js
 *
 * Regression tests for the AI tutor's context builder (api/context.js).
 *
 * Bug being guarded: typeFromRel() only recognised lessons/, concepts/ and
 * formulas/, so all 115 baccalaureate exercise pages and 79 solution pages in
 * KNOWLEDGE_BASE were dropped by loadWiki() and never reached the model. The
 * catalog nevertheless advertised them, so the model believed it had the exams
 * and answered from its own general knowledge instead of the wiki.
 */

const test = require('node:test');
const assert = require('node:assert');
const { getProjectContext } = require('../api/context');

test('catalog advertises the baccalaureate exams it actually indexes', () => {
  const ctx = getProjectContext('اشرح قانون أوم');
  assert.ok(
    /exercise\/unit_02_bac2008_ex01/.test(ctx),
    'the exercise catalog should list exercise ids, not just claim they exist'
  );
});

test('a year request injects the full text of that year exercises', () => {
  const ctx = getProjectContext('اعطني موضوع امتحان البكالوريا سنة 2008');
  assert.ok(/## تمرين: /.test(ctx), 'expected an injected exercise block');
  assert.ok(/النواة المشعة|زمن نصف العمر/.test(ctx), 'expected the exercise body, not only its id');
});

test('a bare year request still returns that year exercises', () => {
  const ctx = getProjectContext('امتحان 2023');
  assert.ok(/bac2023/.test(ctx), 'expected exercises from 2023');
});

test('exercises from other years are indexed but not injected as bodies', () => {
  const ctx = getProjectContext('اعطني موضوع امتحان البكالوريا سنة 2008');
  // The catalog lists every archived exam so the model knows what exists...
  assert.ok(/unit_03_bac2016_ex35/.test(ctx), 'the catalog should still list 2016 exercises');
  // ...but a 2008 request must not spend its budget on 2016 bodies.
  const injected = ctx.split('## تمارين بكالوريا المطلوبة')[1] || '';
  assert.ok(injected !== '', 'expected an injected exam section');
  assert.ok(!/unit_03_bac2016_ex35/.test(injected), '2016 exercise body leaked into a 2008 request');
  assert.ok(!/bac2016/.test(injected), '2016 bodies leaked into a 2008 request');
});

test('a question without a year does not drag in exercise bodies', () => {
  const ctx = getProjectContext('اشرح قانون أوم في ثنائي القطب');
  assert.ok(
    !/## تمرين /.test(ctx),
    'exercise bodies must only be injected when the student asks for a year'
  );
});

test('solutions are withheld until the student asks for the solution', () => {
  const bare = getProjectContext('اعطني موضوع امتحان البكالوريا سنة 2008');
  assert.ok(!/solution\/unit_02_bac2008_ex01/.test(bare), 'the exam request must not leak the solution');

  const asked = getProjectContext('اعطني حل تمرين البكالوريا سنة 2008');
  assert.ok(/solution\/unit_02_bac2008_ex01/.test(asked), 'asking for the solution should include it');
});

test('naming a unit restricts the injected exams to that unit', () => {
  const ctx = getProjectContext('امتحان 2015 الوحدة الثانية');
  const injected = ctx.split('## تمارين بكالوريا المطلوبة')[1] || '';
  assert.ok(/## تمرين: `exercise\/unit_02_bac2015_ex/.test(injected), 'expected unit 2 exercises');
  assert.ok(!/## تمرين: `exercise\/unit_03_/.test(injected), 'unit 3 leaked into a unit 2 request');
  assert.ok(!/## تمرين: `exercise\/unit_04_/.test(injected), 'unit 4 leaked into a unit 2 request');
  assert.ok(!/bac2016/.test(injected), 'a 2016 exercise leaked into a 2015 request');
});

test('no YAML frontmatter leaks into any injected page', () => {
  for (const q of ['اعطني موضوع امتحان البكالوريا سنة 2008', 'اشرح قانون أوم في ثنائي القطب']) {
    const ctx = getProjectContext(q);
    assert.ok(!/\nid: (exercise|concept|formula|lesson|solution)\//.test(ctx), 'frontmatter leaked for: ' + q);
    assert.ok(!/^--$/m.test(ctx), 'a stray frontmatter fence leaked for: ' + q);
  }
});

test('the context stays inside its total budget', () => {
  for (const q of [
    'اعطني موضوع امتحان البكالوريا سنة 2008',
    'اعطني حل تمرين البكالوريا سنة 2015',
    'امتحان 2021',
    'اشرح قانون أوم'
  ]) {
    assert.ok(getProjectContext(q).length <= 60000, 'context exceeded MAX_TOTAL for: ' + q);
  }
});
