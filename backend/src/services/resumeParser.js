const { PDFParse } = require('pdf-parse');
const { generateJson } = require('./gemini');

const EMPTY_SECTIONS = {
  basics: { name: '', title: '', email: '', phone: '', location: '', links: [] },
  summary: '',
  experience: [],
  education: [],
  skills: [],
  projects: [],
  certifications: [],
  languages: [],
  interests: [],
};

async function extractTextFromPdf(buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return (result.text || '').trim();
  } finally {
    await parser.destroy();
  }
}

async function parseResumeText(rawText) {
  if (!rawText || rawText.length < 20) {
    return { rawText: rawText || '', parsedSections: { ...EMPTY_SECTIONS } };
  }

  const prompt = `You are a resume parser. Extract structured data from this resume text.
Return ONLY valid JSON with this exact shape:
{
  "parsedSections": {
    "basics": { "name": "", "title": "", "email": "", "phone": "", "location": "", "links": [{"label":"","url":""}] },
    "summary": "",
    "experience": [{ "role": "", "company": "", "period": "", "bullets": [""] }],
    "education": [{ "degree": "", "school": "", "period": "" }],
    "skills": [""],
    "projects": [{ "name": "", "tech": [""], "summary": "" }],
    "certifications": [{ "name": "", "year": 2024 }],
    "languages": [""],
    "interests": [""]
  }
}

Resume text:
---
${rawText.slice(0, 12000)}
---`;

  try {
    const data = await generateJson(prompt, 'resume parse');
    return {
      rawText,
      parsedSections: { ...EMPTY_SECTIONS, ...(data.parsedSections || data) },
    };
  } catch {
    return {
      rawText,
      parsedSections: {
        ...EMPTY_SECTIONS,
        summary: rawText.slice(0, 500),
      },
    };
  }
}

async function parsePdfBuffer(buffer) {
  const rawText = await extractTextFromPdf(buffer);
  return parseResumeText(rawText);
}

module.exports = { parsePdfBuffer, parseResumeText, extractTextFromPdf };
