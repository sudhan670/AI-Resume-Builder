const express = require('express');
const { z } = require('zod');
const { supabaseAdmin, supabaseAnon } = require('../config/supabase');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { mapUser } = require('../utils/mappers');
const {
  setAuthCookies,
  clearAuthCookies,
  requireAuth,
} = require('../middleware/auth');

const router = express.Router();

const registerSchema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const profileSchema = z.object({
  name: z.string().min(1).max(80),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { name, email, password } = registerSchema.parse(req.body);

    const { data, error } = await supabaseAnon.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });

    if (error) {
      if (error.message?.includes('already registered')) {
        throw ApiError.conflict('Email already in use');
      }
      throw ApiError.badRequest(error.message);
    }

    if (!data.session) {
      throw ApiError.badRequest(
        'Registration requires email confirmation. Disable email confirmation in Supabase Auth settings for development, or confirm your email.'
      );
    }

    await supabaseAdmin
      .from('profiles')
      .upsert({ id: data.user.id, name, email }, { onConflict: 'id' });

    setAuthCookies(res, data.session);

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    res.status(201).json({ user: mapUser(profile || { id: data.user.id, name, email, created_at: data.user.created_at }) });
  })
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);

    const { data, error } = await supabaseAnon.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    setAuthCookies(res, data.session);

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    res.json({
      user: mapUser(
        profile || {
          id: data.user.id,
          name: data.user.user_metadata?.name || '',
          email: data.user.email,
          created_at: data.user.created_at,
        }
      ),
    });
  })
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    clearAuthCookies(res);
    res.json({ ok: true });
  })
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user });
  })
);

router.patch(
  '/profile',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { name } = profileSchema.parse(req.body);

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ name })
      .eq('id', req.user._id)
      .select()
      .single();

    if (error) throw ApiError.internal(error.message);

    res.json({ user: mapUser(data) });
  })
);

router.patch(
  '/password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = passwordSchema.parse(req.body);

    const { error: signInError } = await supabaseAnon.auth.signInWithPassword({
      email: req.user.email,
      password: currentPassword,
    });

    if (signInError) {
      throw ApiError.unauthorized('Current password is incorrect');
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(req.user._id, {
      password: newPassword,
    });

    if (error) throw ApiError.badRequest(error.message);

    res.json({ ok: true });
  })
);

module.exports = router;
