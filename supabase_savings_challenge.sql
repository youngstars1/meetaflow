-- ============================================================
-- MetaFlow: Savings Challenge CLP Table + Row Level Security
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

create table if not exists public.savings_challenges (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null default 'Mi Ahorro Programado',
  target_amount numeric(15,0) not null default 5000000,
  mode text not null default 'automatic', -- 'automatic' | 'custom'
  blocks jsonb not null default '[]', -- Array of { amount: number, selected: boolean, id: string }
  total_saved numeric(15,0) not null default 0,
  completed boolean not null default false,
  milestones_shown jsonb not null default '[]', -- [25, 50, 75, 100] already shown
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.savings_challenges enable row level security;

create policy "Users own their savings challenges" on public.savings_challenges
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
