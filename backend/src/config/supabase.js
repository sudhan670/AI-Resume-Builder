const { createClient } = require('@supabase/supabase-js');
const env = require('./env');

function createSupabaseClient(key, options = {}) {
  if (!env.supabaseUrl || !key) {
    throw new Error('Supabase URL and API key are required');
  }
  return createClient(env.supabaseUrl, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    ...options,
  });
}

/** Service-role client — backend only, bypasses RLS */
const supabaseAdmin = createSupabaseClient(env.supabaseSecretKey);

/** Anon client for auth sign-in/sign-up flows */
const supabaseAnon = createSupabaseClient(env.supabasePublishableKey);

async function connectDB() {
  const { error } = await supabaseAdmin.from('profiles').select('id').limit(1);
  if (error) {
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      console.error(
        '\n⚠️  Database tables not found. Run supabase/schema.sql in your Supabase SQL Editor first.\n'
      );
      throw new Error('Database schema not applied');
    }
    console.warn('Supabase connection warning:', error.message);
  } else {
    console.log('✅ Supabase connected');
  }
}

module.exports = {
  supabaseAdmin,
  supabaseAnon,
  connectDB,
};
