# AI Resume Builder

Full-stack AI-powered resume builder with Supabase backend, Gemini ATS analysis, and a React frontend.

## Stack

- **Frontend:** React + Vite + TanStack Query + Tailwind
- **Backend:** Express + Supabase (Auth + PostgreSQL)
- **AI:** Google Gemini (resume parsing, ATS scoring, bullet rewrites)

## Quick start

### 1. Apply Supabase database schema

Open the [Supabase SQL Editor](https://supabase.com/dashboard/project/oylbulgxhdjahkfgyptx/sql/new) and run the contents of [`supabase/schema.sql`](supabase/schema.sql).

This creates tables, RLS policies, and the profile auto-create trigger.

### 2. Configure Supabase Auth (recommended for dev)

In Supabase Dashboard → **Authentication → Providers → Email**:

- Disable **Confirm email** for local development (so register/login works immediately)

### 3. Backend

```bash
cd backend
cp .env.example .env   # already configured if you have credentials
npm install
npm run dev
```

Server runs at `http://localhost:5000`

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs at `http://localhost:5173` (proxies `/api` → backend)

## Environment variables

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Public anon/publishable key |
| `SUPABASE_SECRET_KEY` | Service role key (backend only) |
| `SUPABASE_JWKS_URL` | JWT verification JWKS endpoint |
| `GEMINI_API_KEY` | Google AI API key for analysis |
| `GEMINI_MODEL` | Model name (default: `gemini-2.5-flash`) |
| `CLIENT_ORIGIN` | Allowed frontend origins (production CORS) |
| `DATABASE_URL` | Optional Postgres URL for `npm run migrate` |

## API routes

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Sign in |
| POST | `/api/auth/logout` | Sign out |
| GET | `/api/auth/me` | Current user |
| PATCH | `/api/auth/profile` | Update name |
| PATCH | `/api/auth/password` | Change password |
| GET/POST | `/api/resumes` | List / upload PDF |
| GET | `/api/resumes/:id` | Resume + versions |
| POST | `/api/resumes/:id/analyze` | Run ATS analysis |
| POST | `/api/resumes/:id/rewrite` | Apply bullet rewrites |
| GET | `/api/dashboard` | Dashboard stats |
| GET | `/api/insights` | Analytics insights |
| GET | `/api/versions` | All versions |
| GET | `/api/history` | Activity history |

## Security notes

- Never commit `.env` or expose `SUPABASE_SECRET_KEY` in the frontend
- Rotate keys if they were shared publicly
- Use RLS policies (included in schema) when accessing Supabase directly from clients
