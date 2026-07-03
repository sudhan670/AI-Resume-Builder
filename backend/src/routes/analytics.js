const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { mapActivity } = require('../utils/mappers');

function createInsightsRouter() {
  const router = express.Router();
  router.use(requireAuth);

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const userId = req.user._id;

      const [{ data: analyses }, { data: resumes }, { data: versions }] = await Promise.all([
        supabaseAdmin.from('analyses').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
        supabaseAdmin.from('resumes').select('id, title').eq('user_id', userId),
        supabaseAdmin.from('resume_versions').select('id, resume_id, label, score, created_at').eq('user_id', userId),
      ]);

      const resumeMap = Object.fromEntries((resumes || []).map((r) => [r.id, r.title]));
      const scores = (analyses || []).map((a) => a.ats_score);
      const averageScore = scores.length
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0;

      let best = { value: 0, resumeId: null, resumeTitle: '' };
      for (const a of analyses || []) {
        if (a.ats_score >= best.value) {
          best = {
            value: a.ats_score,
            resumeId: a.resume_id,
            resumeTitle: resumeMap[a.resume_id] || '',
          };
        }
      }

      const issueCounts = {};
      for (const a of analyses || []) {
        for (const issue of a.issues || []) {
          issueCounts[issue.title] = (issueCounts[issue.title] || 0) + 1;
        }
      }

      const missingKw = {};
      const presentKw = {};
      for (const a of analyses || []) {
        for (const k of a.keywords_missing || []) missingKw[k] = (missingKw[k] || 0) + 1;
        for (const k of a.keywords_present || []) presentKw[k] = (presentKw[k] || 0) + 1;
      }

      const resumePerformance = (resumes || []).map((r) => {
        const rVersions = (versions || []).filter((v) => v.resume_id === r.id);
        const rAnalyses = (analyses || []).filter((a) => a.resume_id === r.id);
        const rScores = rVersions.map((v) => v.score).filter((s) => s != null);
        const latestScore = rScores.length ? rScores[rScores.length - 1] : 0;
        const bestScore = rScores.length ? Math.max(...rScores) : 0;
        return {
          resumeId: r.id,
          title: r.title,
          latestScore,
          bestScore,
          improvement: rScores.length >= 2 ? rScores[rScores.length - 1] - rScores[0] : 0,
          analysesCount: rAnalyses.length,
        };
      });

      res.json({
        averageScore,
        bestScore: best,
        totalAnalyses: analyses?.length || 0,
        scoreTrend: (analyses || []).map((a) => ({
          score: a.ats_score,
          at: a.created_at,
          resumeTitle: resumeMap[a.resume_id]?.split('—').pop()?.trim() || '',
        })),
        topIssues: Object.entries(issueCounts)
          .map(([title, count]) => ({ title, severity: 'high', count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
        topMissingKeywords: Object.entries(missingKw)
          .map(([keyword, count]) => ({ keyword, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
        topPresentKeywords: Object.entries(presentKw)
          .map(([keyword, count]) => ({ keyword, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
        resumePerformance,
      });
    })
  );

  return router;
}

function createVersionsRouter() {
  const router = express.Router();
  router.use(requireAuth);

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const userId = req.user._id;

      const [{ data: versions }, { data: resumes }] = await Promise.all([
        supabaseAdmin
          .from('resume_versions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
        supabaseAdmin.from('resumes').select('id, title').eq('user_id', userId),
      ]);

      const resumeMap = Object.fromEntries((resumes || []).map((r) => [r.id, r.title]));

      res.json({
        totals: {
          all: versions?.length || 0,
          uploads: (versions || []).filter((v) => v.source_type === 'upload').length,
          rewrites: (versions || []).filter((v) => v.source_type === 'rewrite').length,
        },
        versions: (versions || []).map((v) => ({
          id: v.id,
          label: v.label,
          resumeId: v.resume_id,
          resumeTitle: resumeMap[v.resume_id]?.split('—').pop()?.trim() || resumeMap[v.resume_id] || '',
          sourceType: v.source_type,
          score: v.score,
          createdAt: v.created_at,
        })),
      });
    })
  );

  return router;
}

function createHistoryRouter() {
  const router = express.Router();
  router.use(requireAuth);

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const userId = req.user._id;

      const { data: events } = await supabaseAdmin
        .from('activity_events')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      const totals = { all: 0, upload: 0, analyze: 0, rewrite: 0 };
      for (const e of events || []) {
        totals.all += 1;
        if (totals[e.type] != null) totals[e.type] += 1;
      }

      res.json({
        totals,
        events: (events || []).map((e) => ({
          ...mapActivity(e),
          label: e.label || e.type,
        })),
      });
    })
  );

  return router;
}

module.exports = {
  insightsRouter: createInsightsRouter(),
  versionsRouter: createVersionsRouter(),
  historyRouter: createHistoryRouter(),
};
