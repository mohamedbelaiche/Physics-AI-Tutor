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