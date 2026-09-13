// GET /api/skills
// Returns the student's skill mastery (from student_learning_profile.public) plus
// the skill taxonomy (skills.json). Used by dashboard & skill map.
const { requireUser, getSupabaseConfig } = require('./supabase-server');
const courseData = require('./engine/course-data');

async function handler(req, res) {
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }
  const auth = await requireUser(req, res);
  if (!auth) return;

  try {
    const { url, anonKey } = getSupabaseConfig();
    const headers = {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: 'Bearer ' + auth.token
    };

    const [profileRes, skillsRes, attemptsRes] = await Promise.all([
      fetch(url + '/rest/v1/student_learning_profile?student_id=eq.' + auth.userId, { headers }),
      fetch(url + '/rest/v1/student_skill_profiles?student_id=eq.' + auth.userId + '&select=skill,score,level,status,confidence,questions_answered,correct_answers,updated_at,last_assessment_id&order=updated_at.desc', { headers }),
      fetch(url + '/rest/v1/assessment_attempts?student_id=eq.' + auth.userId + '&select=id,assessment_type,score,skill_results,started_at,completed_at&order=started_at.desc&limit=6', { headers })
    ]);

    const profile = profileRes.ok ? await profileRes.json() : [];
    const skillRows = skillsRes.ok ? await skillsRes.json() : [];
    const attempts = attemptsRes.ok ? await attemptsRes.json() : [];

    const taxonomy = courseData.getSkills();

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(
      JSON.stringify({
        learning_profile: profile[0] || null,
        skills: skillRows,
        taxonomy,
        recent_assessments: attempts
      })
    );
  } catch (err) {
    console.error('skills error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'خطأ داخلي في الخادم.' }));
  }
}

module.exports = handler;
module.exports.default = handler;