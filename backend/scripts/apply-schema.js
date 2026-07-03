const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function applySchema() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.log(`
No DATABASE_URL set. Apply the schema manually:

1. Open Supabase Dashboard → SQL Editor
2. Paste contents of supabase/schema.sql
3. Run the query

Project URL: ${process.env.SUPABASE_URL || '(set SUPABASE_URL in .env)'}
`);
    process.exit(0);
  }

  let pg;
  try {
    pg = require('pg');
  } catch {
    console.error('Install pg first: npm install pg');
    process.exit(1);
  }

  const sql = fs.readFileSync(path.resolve(__dirname, '../../supabase/schema.sql'), 'utf8');
  const client = new pg.Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    await client.query(sql);
    console.log('✅ Schema applied successfully');
  } catch (err) {
    console.error('❌ Schema apply failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applySchema();
