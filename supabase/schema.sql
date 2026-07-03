-- AI Resume Builder — Supabase schema
-- Run in Supabase Dashboard → SQL Editor (or via scripts/apply-schema.js with DATABASE_URL)

-- Profiles (extends auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Resumes
create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Resume versions
create table if not exists public.resume_versions (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null references public.resumes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  source_type text not null check (source_type in ('upload', 'rewrite')),
  score integer,
  raw_text text not null default '',
  parsed_sections jsonb not null default '{}'::jsonb,
  parent_version_id uuid references public.resume_versions (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.resumes
  drop constraint if exists resumes_current_version_id_fkey;

alter table public.resumes
  add constraint resumes_current_version_id_fkey
  foreign key (current_version_id) references public.resume_versions (id) on delete set null;

-- ATS analyses
create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null references public.resumes (id) on delete cascade,
  version_id uuid not null references public.resume_versions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  ats_score integer not null,
  model text not null,
  summary text not null default '',
  score_breakdown jsonb not null default '[]'::jsonb,
  issues jsonb not null default '[]'::jsonb,
  strengths jsonb not null default '[]'::jsonb,
  keywords_present jsonb not null default '[]'::jsonb,
  keywords_missing jsonb not null default '[]'::jsonb,
  bullet_rewrites jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (version_id)
);

-- Activity feed / history
create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  resume_id uuid references public.resumes (id) on delete cascade,
  type text not null check (type in ('upload', 'analyze', 'rewrite')),
  title text not null,
  subtitle text not null default '',
  label text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_resumes_user_id on public.resumes (user_id);
create index if not exists idx_resume_versions_resume_id on public.resume_versions (resume_id);
create index if not exists idx_analyses_resume_id on public.analyses (resume_id);
create index if not exists idx_activity_events_user_id on public.activity_events (user_id, created_at desc);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists resumes_updated_at on public.resumes;
create trigger resumes_updated_at
  before update on public.resumes
  for each row execute function public.set_updated_at();

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.resumes enable row level security;
alter table public.resume_versions enable row level security;
alter table public.analyses enable row level security;
alter table public.activity_events enable row level security;

-- Profiles policies
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Resumes policies
drop policy if exists "Users can manage own resumes" on public.resumes;
create policy "Users can manage own resumes"
  on public.resumes for all using (auth.uid() = user_id);

-- Versions policies
drop policy if exists "Users can manage own versions" on public.resume_versions;
create policy "Users can manage own versions"
  on public.resume_versions for all using (auth.uid() = user_id);

-- Analyses policies
drop policy if exists "Users can manage own analyses" on public.analyses;
create policy "Users can manage own analyses"
  on public.analyses for all using (auth.uid() = user_id);

-- Activity policies
drop policy if exists "Users can manage own activity" on public.activity_events;
create policy "Users can manage own activity"
  on public.activity_events for all using (auth.uid() = user_id);
