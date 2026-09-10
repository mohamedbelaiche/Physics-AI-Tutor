const { getProjectContext } = require('./context');
const { requireUser, getSupabaseConfig } = require('./supabase-server');

const ACADEMIC_INSTRUCTION =
  'إذا وُجد "الملف الأكاديمي للطالب" أعلاه، حسّن الجواب بناءً عليه: ' +
  'ابدأ من النقطة الموصى بها "recommended_start"، وركّز على تقوية المهارات الأضعف من "skill_map"، ' +
  'واشرح بحجم يناسب مستوى الطالب دون الكشف عن أرقام التقييم للمستخدم مباشرة.';

const SYSTEM_PROMPT =
  'أنت "المدرس الشخصي للفيزياء"، مدرس فيزياء وعلوم خبير باللغة العربية. ' +
  'أجب بوضوح ودقة عن أسئلة الفيزياء (الميكانيك، الكهرباء، النووية، الكيمياء وغيرها) ' +
  '، اشرح المفاهيم خطوة بخطوة، واعرض الحلول بالتفصيل مع الصيغ الرياضية عند الحاجة.';

function readJsonBody(req, callback) {
  // On Vercel, the body is already parsed into req.body
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

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const auth = await requireUser(req, res);
  if (!auth) return;

  readJsonBody(req, function (data) {
    handleChat(data, res, auth).catch(function (err) {
      console.error('Unhandled chat error:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'خطأ داخلي في الخادم.' }));
      }
    });
  });
}

// Fetch the student's diagnostic academic profile (per-skill map, levels,
// recommended starting point) so the AI can personalize answers. Returns null
// when the student has no assessment yet or the lookup fails.
async function getAcademicContext(auth) {
  try {
    const { url, anonKey } = getSupabaseConfig();
    const res = await fetch(url + '/rest/v1/rpc/get_student_diagnostic_context', {
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
    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) return null;
    return data;
  } catch (err) {
    console.warn('diagnostic context unavailable:', err && err.message);
    return null;
  }
}

async function handleChat(data, res, auth) {
  if (data.__invalid) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'طلب غير صالح: ' + data.message }));
    return;
  }

  const key = process.env.OPENROUTER_API_KEY;
  if (!key || !/^[\x20-\x7E]+$/.test(key)) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(
      JSON.stringify({
        error:
          'لم يتم إعداد مفتاح OpenRouter. أضف OPENROUTER_API_KEY إلى إعدادات بيئة المشروع.'
      })
    );
    return;
  }

  let messages = Array.isArray(data.messages) ? data.messages : [];
  const withoutSystem = messages.filter(function (m) { return m.role !== 'system'; });
  if (!withoutSystem.length) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'لا توجد رسائل' }));
    return;
  }

  const context = await getProjectContext();
  const academic = await getAcademicContext(auth);
  const academicSection = academic
    ? '## الملف الأكاديمي للطالب (من التقييم التشخيصي)\n' + JSON.stringify(academic, null, 2)
    : '';
  const systemContent =
    SYSTEM_PROMPT +
    '\n\n## بيانات المشروع (الوحدات والملخصات)\n' +
    context +
    (academicSection ? '\n\n' + academicSection : '') +
    '\n\nأجب مستندا أولا إلى بيانات المشروع أعلاه. وإن ورد سؤال خارجها أو لم تجد إجابته، قل ذلك بوضوح ثم أجب من معلوماتك العامة.' +
    '\nلا تذكر للمستخدم أنك تستند إلى ملفات، فقط أجب من المحتوى بشكل طبيعي.' +
    (academic ? '\n\n' + ACADEMIC_INSTRUCTION : '');

  const payload = {
    model: data.model || process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
    messages: [{ role: 'system', content: systemContent }].concat(withoutSystem),
    temperature: typeof data.temperature === 'number' ? data.temperature : 0.7
  };

  try {
    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + key,
        'HTTP-Referer': process.env.APP_URL || 'http://localhost:5500',
        'X-Title': 'Physics Tutor'
      },
      body: JSON.stringify(payload)
    });
    const text = await upstream.text();
    res.writeHead(upstream.status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(text);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'تعذر الاتصال بـ OpenRouter: ' + err.message }));
  }
}

module.exports = handler;
module.exports.default = handler;