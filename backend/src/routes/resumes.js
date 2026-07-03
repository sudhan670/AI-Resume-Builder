const express = require('express');
const multer = require('multer');
const { diffWords, diffLines } = require('diff');
const { z } = require('zod');
const env = require('../config/env');
const { supabaseAdmin } = require('../config/supabase');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { requireAuth } = require('../middleware/auth');
const { mapResumeShallow, mapVersion, mapAnalysis } = require('../utils/mappers');
const { parsePdfBuffer } = require('../services/resumeParser');
const { analyzeResume, applyRewrites } = require('../services/resumeAnalysis');
const { logActivity, getResumeStats } = require('../services/activity');

const router = express.Router();
router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === 'application/pdf' ||
      file.originalname?.toLowerCase().endsWith('.pdf');
    cb(ok ? null : ApiError.badRequest('Only PDF files are allowed'), ok);
  },
});

async function assertResumeOwner(resumeId, userId) {
  const { data, error } = await supabaseAdmin
    .from('resumes')
    .select('*')
    .eq('id', resumeId)
    .eq('user_id', userId)
    .single();

  if (error || !data) throw ApiError.notFound('Resume not found');
  return data;
}

async function getVersions(resumeId) {
  const { data } = await supabaseAdmin
    .from('resume_versions')
    .select('*')
    .eq('resume_id', resumeId)
    .order('created_at', { ascending: true });
  return data || [];
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { data: resumes, error } = await supabaseAdmin
      .from('resumes')
      .select('*')
      .eq('user_id', req.user._id)
      .order('updated_at', { ascending: false });

    if (error) throw ApiError.internal(error.message);

    const stats = await getResumeStats((resumes || []).map((r) => r.id));
    res.json({
      resumes: (resumes || []).map((r) => mapResumeShallow(r, stats[r.id])),
    });
  })
);

router.post(
  '/',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest('PDF file is required');

    const title = req.body.title || req.file.originalname?.replace(/\.pdf$/i, '') || 'Untitled Resume';
    const { rawText, parsedSections } = await parsePdfBuffer(req.file.buffer);

    const { data: resume, error: resumeError } = await supabaseAdmin
      .from('resumes')
      .insert({ user_id: req.user._id, title })
      .select()
      .single();

    if (resumeError) throw ApiError.internal(resumeError.message);

    const { data: version, error: versionError } = await supabaseAdmin
      .from('resume_versions')
      .insert({
        resume_id: resume.id,
        user_id: req.user._id,
        label: 'V1',
        source_type: 'upload',
        raw_text: rawText,
        parsed_sections: parsedSections,
      })
      .select()
      .single();

    if (versionError) throw ApiError.internal(versionError.message);

    await supabaseAdmin
      .from('resumes')
      .update({ current_version_id: version.id, updated_at: new Date().toISOString() })
      .eq('id', resume.id);

    const sectionCount = Object.keys(parsedSections).filter(
      (k) => parsedSections[k] && (Array.isArray(parsedSections[k]) ? parsedSections[k].length : true)
    ).length;

    await logActivity({
      userId: req.user._id,
      resumeId: resume.id,
      type: 'upload',
      title: `${req.file.originalname} uploaded`,
      subtitle: `Parsed ${sectionCount} sections`,
      label: 'V1',
    });

    res.status(201).json({
      resume: {
        ...mapResumeShallow({ ...resume, current_version_id: version.id }),
        currentVersionId: version.id,
        versions: [mapVersion(version)],
      },
    });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const resume = await assertResumeOwner(req.params.id, req.user._id);
    const versions = await getVersions(resume.id);

    res.json({
      resume: {
        _id: resume.id,
        title: resume.title,
        createdAt: resume.created_at,
        updatedAt: resume.updated_at,
        currentVersionId: resume.current_version_id,
      },
      versions: versions.map(mapVersion),
    });
  })
);

router.get(
  '/:id/versions/:versionId',
  asyncHandler(async (req, res) => {
    await assertResumeOwner(req.params.id, req.user._id);

    const { data: version, error } = await supabaseAdmin
      .from('resume_versions')
      .select('*')
      .eq('id', req.params.versionId)
      .eq('resume_id', req.params.id)
      .single();

    if (error || !version) throw ApiError.notFound('Version not found');
    res.json({ version: mapVersion(version) });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await assertResumeOwner(req.params.id, req.user._id);

    const { error } = await supabaseAdmin
      .from('resumes')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user._id);

    if (error) throw ApiError.internal(error.message);
    res.json({ ok: true });
  })
);

router.post(
  '/:id/analyze',
  asyncHandler(async (req, res) => {
    const resume = await assertResumeOwner(req.params.id, req.user._id);
    const body = z
      .object({
        versionId: z.string().uuid().optional(),
        jobDescription: z.string().optional(),
      })
      .parse(req.body);

    const versionId = body.versionId || resume.current_version_id;
    if (!versionId) throw ApiError.badRequest('No version to analyze');

    const { data: version, error: vErr } = await supabaseAdmin
      .from('resume_versions')
      .select('*')
      .eq('id', versionId)
      .eq('resume_id', resume.id)
      .single();

    if (vErr || !version) throw ApiError.notFound('Version not found');

    const analysisResult = await analyzeResume(version, body.jobDescription);

    const { data: analysis, error } = await supabaseAdmin
      .from('analyses')
      .upsert(
        {
          resume_id: resume.id,
          version_id: version.id,
          user_id: req.user._id,
          ats_score: analysisResult.atsScore,
          model: env.geminiModel,
          summary: analysisResult.summary,
          score_breakdown: analysisResult.scoreBreakdown,
          issues: analysisResult.issues,
          strengths: analysisResult.strengths,
          keywords_present: analysisResult.keywordsPresent,
          keywords_missing: analysisResult.keywordsMissing,
          bullet_rewrites: analysisResult.bulletRewrites,
        },
        { onConflict: 'version_id' }
      )
      .select()
      .single();

    if (error) throw ApiError.internal(error.message);

    await supabaseAdmin
      .from('resume_versions')
      .update({ score: analysisResult.atsScore })
      .eq('id', version.id);

    await supabaseAdmin
      .from('resumes')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', resume.id);

    await logActivity({
      userId: req.user._id,
      resumeId: resume.id,
      type: 'analyze',
      title: `Analysis complete on ${version.label}`,
      subtitle: `ATS score ${analysisResult.atsScore} / 100`,
      label: `+${Math.max(0, analysisResult.atsScore - (version.score || 0))} pts`,
    });

    res.json({ analysis: mapAnalysis(analysis) });
  })
);

router.get(
  '/:id/analyses',
  asyncHandler(async (req, res) => {
    await assertResumeOwner(req.params.id, req.user._id);

    const { data, error } = await supabaseAdmin
      .from('analyses')
      .select('*')
      .eq('resume_id', req.params.id)
      .order('created_at', { ascending: false });

    if (error) throw ApiError.internal(error.message);
    res.json({ analyses: (data || []).map(mapAnalysis) });
  })
);

router.get(
  '/:id/versions/:versionId/analysis',
  asyncHandler(async (req, res) => {
    await assertResumeOwner(req.params.id, req.user._id);

    const { data, error } = await supabaseAdmin
      .from('analyses')
      .select('*')
      .eq('resume_id', req.params.id)
      .eq('version_id', req.params.versionId)
      .maybeSingle();

    if (error) throw ApiError.internal(error.message);
    if (!data) throw ApiError.notFound('No analysis for this version');
    res.json({ analysis: mapAnalysis(data) });
  })
);

router.post(
  '/:id/rewrite',
  asyncHandler(async (req, res) => {
    const resume = await assertResumeOwner(req.params.id, req.user._id);
    const body = z
      .object({
        versionId: z.string().uuid().optional(),
        rewriteIds: z.array(z.string()).default([]),
      })
      .parse(req.body);

    const sourceVersionId = body.versionId || resume.current_version_id;
    const { data: sourceVersion, error: svErr } = await supabaseAdmin
      .from('resume_versions')
      .select('*')
      .eq('id', sourceVersionId)
      .eq('resume_id', resume.id)
      .single();

    if (svErr || !sourceVersion) throw ApiError.notFound('Source version not found');

    const { data: analysis } = await supabaseAdmin
      .from('analyses')
      .select('bullet_rewrites')
      .eq('version_id', sourceVersion.id)
      .maybeSingle();

    const rewrites = analysis?.bullet_rewrites || [];
    const idsToApply =
      body.rewriteIds.length > 0
        ? body.rewriteIds
        : rewrites.map((r) => r._id || r.id);

    const updatedSections = applyRewrites(
      sourceVersion.parsed_sections,
      rewrites,
      idsToApply
    );

    const versions = await getVersions(resume.id);
    const nextLabel = `V${versions.length + 1}`;

    const { data: newVersion, error: nvErr } = await supabaseAdmin
      .from('resume_versions')
      .insert({
        resume_id: resume.id,
        user_id: req.user._id,
        label: nextLabel,
        source_type: 'rewrite',
        parent_version_id: sourceVersion.id,
        raw_text: sourceVersion.raw_text,
        parsed_sections: updatedSections,
        score: sourceVersion.score,
      })
      .select()
      .single();

    if (nvErr) throw ApiError.internal(nvErr.message);

    await supabaseAdmin
      .from('resumes')
      .update({
        current_version_id: newVersion.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', resume.id);

    await logActivity({
      userId: req.user._id,
      resumeId: resume.id,
      type: 'rewrite',
      title: `${idsToApply.length} bullets rewritten`,
      subtitle: 'Applied to resume sections',
      label: `${nextLabel} created`,
    });

    res.json({
      version: mapVersion(newVersion),
      appliedCount: idsToApply.length,
    });
  })
);

router.get(
  '/:id/diff',
  asyncHandler(async (req, res) => {
    await assertResumeOwner(req.params.id, req.user._id);

    const { from, to, mode = 'words' } = req.query;
    if (!from || !to) throw ApiError.badRequest('from and to version IDs are required');

    const { data: versions } = await supabaseAdmin
      .from('resume_versions')
      .select('id, raw_text, parsed_sections')
      .eq('resume_id', req.params.id)
      .in('id', [from, to]);

    const fromV = versions?.find((v) => v.id === from);
    const toV = versions?.find((v) => v.id === to);
    if (!fromV || !toV) throw ApiError.notFound('Version not found');

    const textFrom = JSON.stringify(fromV.parsed_sections, null, 2);
    const textTo = JSON.stringify(toV.parsed_sections, null, 2);
    const parts = mode === 'lines' ? diffLines(textFrom, textTo) : diffWords(textFrom, textTo);

    const hunks = [];
    for (const part of parts) {
      if (part.added) hunks.push({ type: 'add', text: part.value.trim() });
      else if (part.removed) hunks.push({ type: 'remove', text: part.value.trim() });
      else if (part.value.trim()) hunks.push({ type: 'context', text: part.value.trim() });
    }

    res.json({ hunks: hunks.filter((h) => h.text).slice(0, 50) });
  })
);

module.exports = router;
