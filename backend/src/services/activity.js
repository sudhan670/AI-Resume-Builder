const { supabaseAdmin } = require('../config/supabase');
const { mapActivity } = require('../utils/mappers');

async function logActivity({ userId, resumeId, type, title, subtitle = '', label = '', metadata = {} }) {
  const { data, error } = await supabaseAdmin
    .from('activity_events')
    .insert({
      user_id: userId,
      resume_id: resumeId,
      type,
      title,
      subtitle,
      label,
      metadata,
    })
    .select()
    .single();

  if (error) {
    console.warn('Failed to log activity:', error.message);
    return null;
  }
  return mapActivity(data);
}

async function getResumeStats(resumeIds) {
  if (!resumeIds.length) return {};

  const { data: versions } = await supabaseAdmin
    .from('resume_versions')
    .select('resume_id, score')
    .in('resume_id', resumeIds);

  const stats = {};
  for (const id of resumeIds) {
    stats[id] = { versionCount: 0, bestScore: null };
  }
  for (const v of versions || []) {
    stats[v.resume_id].versionCount += 1;
    if (v.score != null) {
      stats[v.resume_id].bestScore =
        stats[v.resume_id].bestScore == null
          ? v.score
          : Math.max(stats[v.resume_id].bestScore, v.score);
    }
  }
  return stats;
}

module.exports = { logActivity, getResumeStats };
