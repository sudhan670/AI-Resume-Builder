const { randomUUID } = require('crypto');
const { generateJson } = require('./gemini');

async function analyzeResume(version, jobDescription = '') {
  const sections = version.parsed_sections || version.parsedSections || {};
  const prompt = `You are an expert ATS resume analyst. Analyze this resume and return ONLY valid JSON:
{
  "atsScore": 0-100,
  "summary": "2-3 sentence overview",
  "scoreBreakdown": [{ "label": "Keywords|Format|Impact|Readability|Action verbs", "value": 0-100 }],
  "issues": [{ "title": "", "severity": "high|medium|low", "fix": "" }],
  "strengths": [{ "title": "", "note": "" }],
  "keywordsPresent": [""],
  "keywordsMissing": [""],
  "bulletRewrites": [{ "section": "experience|summary|projects", "original": "", "rewritten": "", "rationale": "" }]
}

Provide 3-5 issues, 3-5 strengths, and 3-6 bullet rewrites for weak bullets.
${jobDescription ? `Target job description:\n${jobDescription.slice(0, 3000)}\n` : ''}

Resume JSON:
${JSON.stringify(sections).slice(0, 10000)}`;

  const data = await generateJson(prompt, 'resume analysis');

  const bulletRewrites = (data.bulletRewrites || []).map((rw) => ({
    _id: randomUUID(),
    section: rw.section || 'experience',
    original: rw.original || '',
    rewritten: rw.rewritten || '',
    rationale: rw.rationale || '',
  }));

  return {
    atsScore: Math.min(100, Math.max(0, Number(data.atsScore) || 65)),
    summary: data.summary || 'Analysis complete.',
    scoreBreakdown: data.scoreBreakdown || [],
    issues: data.issues || [],
    strengths: data.strengths || [],
    keywordsPresent: data.keywordsPresent || [],
    keywordsMissing: data.keywordsMissing || [],
    bulletRewrites,
  };
}

function applyRewrites(parsedSections, rewrites, rewriteIds) {
  const sections = JSON.parse(JSON.stringify(parsedSections));
  const selected = rewrites.filter((rw) => rewriteIds.includes(rw._id));

  for (const rw of selected) {
    if (rw.section === 'summary' && sections.summary) {
      if (sections.summary.includes(rw.original)) {
        sections.summary = sections.summary.replace(rw.original, rw.rewritten);
      }
      continue;
    }

    if (rw.section === 'experience' && Array.isArray(sections.experience)) {
      for (const exp of sections.experience) {
        if (!Array.isArray(exp.bullets)) continue;
        exp.bullets = exp.bullets.map((b) =>
          b === rw.original || b.includes(rw.original) ? rw.rewritten : b
        );
      }
    }

    if (rw.section === 'projects' && Array.isArray(sections.projects)) {
      for (const proj of sections.projects) {
        if (proj.summary?.includes(rw.original)) {
          proj.summary = proj.summary.replace(rw.original, rw.rewritten);
        }
      }
    }
  }

  return sections;
}

module.exports = { analyzeResume, applyRewrites };
