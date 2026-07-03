const express = require('express');
const { supabaseAdmin } = require('../config/supabase');

const router = express.Router();

router.get('/', async (_req, res) => {
  let db = 'unknown';
  try {
    const { error } = await supabaseAdmin.from('profiles').select('id').limit(1);
    db = error ? 'error' : 'connected';
  } catch {
    db = 'disconnected';
  }

  res.json({
    status: 'ok',
    uptime: process.uptime(),
    db,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
