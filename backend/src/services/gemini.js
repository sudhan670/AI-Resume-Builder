const { GoogleGenAI } = require('@google/genai');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

let ai = null;

function getClient() {
  if (!env.geminiApiKey) {
    throw ApiError.internal('GEMINI_API_KEY is not configured');
  }
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: env.geminiApiKey });
  }
  return ai;
}

async function generateJson(prompt, schemaHint) {
  const client = getClient();
  const response = await client.models.generateContent({
    model: env.geminiModel,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.3,
    },
  });

  const text = response.text?.trim();
  if (!text) {
    throw ApiError.internal('Empty response from AI model');
  }

  try {
    return JSON.parse(text);
  } catch {
    throw ApiError.internal(`Invalid JSON from AI model${schemaHint ? `: ${schemaHint}` : ''}`);
  }
}

module.exports = { generateJson };
