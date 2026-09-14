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