const env = require('../config/env');
const { supabaseAdmin } = require('../config/supabase');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { mapUser } = require('../utils/mappers');

function setAuthCookies(res, session) {
  const cookieOpts = {
    httpOnly: true,
    secure: env.isProd,
    sameSite: env.isProd ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  };

  res.cookie(env.cookieName, session.access_token, cookieOpts);
  if (session.refresh_token) {
    res.cookie(env.refreshCookieName, session.refresh_token, {
      ...cookieOpts,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }
}

function clearAuthCookies(res) {
  res.clearCookie(env.cookieName, { path: '/' });
  res.clearCookie(env.refreshCookieName, { path: '/' });
}

async function resolveUserFromToken(token) {
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  if (!profile) {
    return mapUser({
      id: data.user.id,
      name: data.user.user_metadata?.name || data.user.email?.split('@')[0] || '',
      email: data.user.email,
      created_at: data.user.created_at,
    });
  }

  return mapUser(profile);
}

const requireAuth = asyncHandler(async (req, res, next) => {
  let token = req.cookies?.[env.cookieName];

  if (!token) {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      token = header.slice(7);
    }
  }

  const user = await resolveUserFromToken(token);
  if (!user) {
    throw ApiError.unauthorized('Not authenticated');
  }

  req.user = user;
  req.accessToken = token;
  next();
});

const optionalAuth = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.[env.cookieName];
  req.user = token ? await resolveUserFromToken(token) : null;
  next();
});

module.exports = {
  setAuthCookies,
  clearAuthCookies,
  requireAuth,
  optionalAuth,
  resolveUserFromToken,
};
