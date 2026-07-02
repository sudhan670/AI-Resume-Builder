const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const required = ['MONGO_URI', 'JWT_SECRET'];
const missing = required.filter((key) => !process.env[key]);

if (missing.length) {
    console.warn(`Missing environment variables: ${missing.join(', ')}`);
}

module.exports = {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: Number(process.env.PORT) || 5000,
    mongoUri: process.env.MONGO_URI ,
    jwtSecret: process.env.JWT_SECRET || 'dev-secret',
    cookieName: process.env.COOKIE_NAME || 'arr_token',
    clientOrigin: (process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://localhost:5174')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    isProd: process.env.NODE_ENV === 'production',
};
