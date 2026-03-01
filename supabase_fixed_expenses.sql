-- ============================================================
-- MetaFlow: Fixed Expenses Table + RLS (Updated v2)
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

-- Drop old policy if exists (in case re-running)
drop policy if exists "Users own their fixed_expenses" on public.fixed_expenses;
drop policy if exists "fixed_expenses_select" on public.fixed_expenses;
drop policy if exists "fixed_expenses_insert" on public.fixed_expenses;
drop policy if exists "fixed_expenses_update" on public.fixed_expenses;
drop policy if exists "fixed_expenses_delete" on public.fixed_expenses;

-- Granular RLS policies
create policy "fixed_expenses_select" on public.fixed_expenses for select using (auth.uid() = user_id);
create policy "fixed_expenses_insert" on public.fixed_expenses for insert with check (auth.uid() = user_id);
create policy "fixed_expenses_update" on public.fixed_expenses for update using (auth.uid() = user_id);
create policy "fixed_expenses_delete" on public.fixed_expenses for delete using (auth.uid() = user_id);

-- Indexes for faster queries
create index if not exists idx_fixed_expenses_user_id on public.fixed_expenses(user_id);
create index if not exists idx_fixed_expenses_active on public.fixed_expenses(user_id, active);

-- Enable Realtime
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE fixed_expenses; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Auto-update trigger
DROP TRIGGER IF EXISTS fixed_expenses_updated_at ON fixed_expenses;
CREATE TRIGGER fixed_expenses_updated_at BEFORE UPDATE ON fixed_expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
