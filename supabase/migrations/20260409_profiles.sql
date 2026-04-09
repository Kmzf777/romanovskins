-- supabase/migrations/20260409_profiles.sql

-- 1. Create profiles table linked to auth.users
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  name text not null,
  whatsapp text not null,
  created_at timestamptz default now() not null
);

-- 2. Enable RLS
alter table public.profiles enable row level security;

-- 3. Policies
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- 4. Service role can do everything (for admin operations)
create policy "Service role full access"
  on public.profiles for all
  using (true)
  with check (true);
