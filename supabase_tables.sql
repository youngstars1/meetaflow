-- ============================================================
-- MetaFlow: Supabase Tables + Row Level Security
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. GOALS
create table if not exists public.goals (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text default '',
  target_amount numeric(15,2) not null default 0,
  current_amount numeric(15,2) not null default 0,
  deadline text,
  priority text default 'medium',
  color text default '#00f5d4',
  image_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.goals enable row level security;
create policy "Users own their goals" on public.goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2. TRANSACTIONS
create table if not exists public.transactions (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null,
  amount numeric(15,2) not null,
  category text default '',
  note text default '',
  date text not null,
  goal_id text,
  decision_type text,
  created_at timestamptz default now()
);
alter table public.transactions enable row level security;
create policy "Users own their transactions" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3. ROUTINES
create table if not exists public.routines (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  objective text default '',
  category text default 'finanzas',
  frequency text default 'daily',
  difficulty text default 'medium',
  xp_value integer default 20,
  completed_dates text[] default '{}',
  streak integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.routines enable row level security;
create policy "Users own their routines" on public.routines
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4. PROFILE  
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text default '',
  currency text default 'CLP',
  income_sources jsonb default '[]',
  gamification jsonb default '{"totalXP":0,"xpLog":[],"earnedBadgeIds":[]}',
  envelopes jsonb default '{"enabled":false,"rules":[]}',
  updated_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "Users own their profile" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (user_id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'display_name', ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
