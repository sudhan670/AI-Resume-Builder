/** Map Supabase rows to frontend-compatible shapes (_id fields). */

function mapUser(profile) {
  if (!profile) return null;
  return {
    _id: profile.id,
    name: profile.name,
    email: profile.email,
    createdAt: profile.created_at,
  };
}

function mapResumeShallow(row, stats = {}) {
  return {
    _id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    versionCount: stats.versionCount ?? 0,
    bestScore: stats.bestScore ?? null,
  };
}

function mapVersion(row) {
  return {
    _id: row.id,
    label: row.label,
    sourceType: row.source_type,
    createdAt: row.created_at,
    score: row.score,
    rawText: row.raw_text,
    parsedSections: row.parsed_sections,
  };
}

function mapAnalysis(row) {
  return {
    _id: row.id,
    versionId: row.version_id,
    atsScore: row.ats_score,
    model: row.model,
    summary: row.summary,
    scoreBreakdown: row.score_breakdown,
    issues: row.issues,
    strengths: row.strengths,
    keywordsPresent: row.keywords_present,
    keywordsMissing: row.keywords_missing,
    bulletRewrites: (row.bullet_rewrites || []).map((rw) => ({
      _id: rw._id || rw.id,
      section: rw.section,
      original: rw.original,
      rewritten: rw.rewritten,
      rationale: rw.rationale,
    })),
  };
}

function mapActivity(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    subtitle: row.subtitle,
    label: row.label,
    at: row.created_at,
    resumeId: row.resume_id,
  };
}

module.exports = {
  mapUser,
  mapResumeShallow,
  mapVersion,
  mapAnalysis,
  mapActivity,
};
