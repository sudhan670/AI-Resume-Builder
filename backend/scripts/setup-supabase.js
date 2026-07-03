const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;

async function runSql(sql) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  return res;
}

async function applyViaPg() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return false;

  let pg;
  try {
    pg = require('pg');
  } catch {
    return false;
  }

  const sql = fs.readFileSync(path.resolve(__dirname, '../../supabase/schema.sql'), 'utf8');
  const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  await client.query(sql);
  await client.end();
  return true;
}

async function main() {
  console.log('Applying Supabase schema...\n');

  if (await applyViaPg()) {
    console.log('✅ Schema applied via DATABASE_URL');
    return;
  }

  // Test if tables already exist
  const check = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id&limit=1`, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
  });

  if (check.ok) {
    console.log('✅ Tables already exist — schema looks applied.');
    return;
  }

  console.log(`
⚠️  Could not apply schema automatically.

Please run the SQL manually:
1. Go to https://supabase.com/dashboard/project/oylbulgxhdjahkfgyptx/sql/new
2. Copy & paste the contents of: supabase/schema.sql
3. Click "Run"

Optional: set DATABASE_URL in backend/.env to enable "npm run migrate"
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
