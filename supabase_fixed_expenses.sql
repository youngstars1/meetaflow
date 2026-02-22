-- ============================================================
-- MetaFlow: Fixed Expenses Table + RLS
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- FIXED EXPENSES (Recurring costs)
create table if not exists public.fixed_expenses (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  amount numeric(15,2) not null default 0,
  category text default 'otros',
  frequency text default 'monthly' check (frequency in ('weekly', 'monthly', 'yearly')),
  next_due_date date,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.fixed_expenses enable row level security;

create policy "Users own their fixed_expenses" on public.fixed_expenses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Index for faster queries
create index if not exists idx_fixed_expenses_user_id on public.fixed_expenses(user_id);
create index if not exists idx_fixed_expenses_active on public.fixed_expenses(user_id, active);
