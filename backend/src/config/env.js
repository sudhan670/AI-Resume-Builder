const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const required = [
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
];

const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.warn(`Missing environment variables: ${missing.join(', ')}`);
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  supabaseUrl: process.env.SUPABASE_URL,
  supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY,
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY,
  supabaseJwksUrl: process.env.SUPABASE_JWKS_URL,
  cookieName: process.env.COOKIE_NAME || 'arr_token',
  refreshCookieName: process.env.REFRESH_COOKIE_NAME || 'arr_refresh',
  clientOrigin: (process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://localhost:5174')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  databaseUrl: process.env.DATABASE_URL || '',
  isProd: process.env.NODE_ENV === 'production',
};
