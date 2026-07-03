const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { requireAuth } = require('../middleware/auth');
const { mapActivity } = require('../utils/mappers');
const { getResumeStats } = require('../services/activity');

const router = express.Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const [
      { data: resumes },
      { data: versions },
      { data: analyses },
      { data: activity },
    ] = await Promise.all([
      supabaseAdmin.from('resumes').select('*').eq('user_id', userId).order('updated_at', { ascending: false }),
      supabaseAdmin.from('resume_versions').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
      supabaseAdmin.from('analyses').select('*').eq('user_id', userId),
      supabaseAdmin
        .from('activity_events')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    const rewriteCount = (versions || []).filter((v) => v.source_type === 'rewrite').length;
    const latestResume = resumes?.[0];

    let scoreSeries = [];
    let versionStack = [];
    let kpiScore = 0;
    let kpiDelta = 0;

    if (latestResume) {
      const resumeVersions = (versions || []).filter((v) => v.resume_id === latestResume.id);
      scoreSeries = resumeVersions.map((v) => ({ label: v.label, score: v.score || 0 }));
      versionStack = resumeVersions.map((v) => ({
        id: v.id,
        label: v.label,
        title: v.source_type === 'upload' ? 'Upload' : 'Rewrite pass',
        score: v.score || 0,
      }));

      const scores = resumeVersions.map((v) => v.score).filter((s) => s != null);
      kpiScore = scores.length ? scores[scores.length - 1] : 0;
      kpiDelta = scores.length >= 2 ? scores[scores.length - 1] - scores[0] : 0;
    }

    const allScores = (analyses || []).map((a) => a.ats_score);
    const issueCount = (analyses || []).reduce((sum, a) => sum + (a.issues?.length || 0), 0);
    const kwPresent = new Set();
    const kwTotal = new Set();
    for (const a of analyses || []) {
      for (const k of a.keywords_present || []) kwPresent.add(k);
      for (const k of [...(a.keywords_present || []), ...(a.keywords_missing || [])]) kwTotal.add(k);
    }

    const spark = (values) => values.map((v) => ({ v }));

    res.json({
      totals: {
        resumes: resumes?.length || 0,
        rewrites: rewriteCount,
        analyses: analyses?.length || 0,
      },
      latestResume: latestResume
        ? { _id: latestResume.id, title: latestResume.title }
        : null,
      scoreSeries,
      versionStack,
      kpi: {
        atsScore: {
          value: kpiScore,
          delta: kpiDelta,
          spark: spark(scoreSeries.map((s) => s.score).length ? scoreSeries.map((s) => s.score) : [0]),
        },
        versions: {
          value: versions?.length || 0,
          spark: spark(Array.from({ length: Math.min(7, (versions?.length || 0) + 1) }, (_, i) => i)),
        },
        issuesIdentified: {
          value: issueCount,
          delta: 0,
          spark: spark([issueCount]),
        },
        keywordsMatched: {
          value: kwPresent.size,
          total: kwTotal.size || kwPresent.size,
          delta: 0,
          spark: spark([kwPresent.size]),
        },
      },
      activity: (activity || []).map(mapActivity),
    });
  })
);

module.exports = router;
