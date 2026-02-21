-- ============================================================
-- MetaFlow — SAFE MIGRATION SCRIPT v2
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- ============================================================
-- STEP 1: Create tables if they don't exist
-- ============================================================

CREATE TABLE IF NOT EXISTS profiles (
    user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name          TEXT DEFAULT '',
    currency      TEXT DEFAULT 'CLP',
    income_sources JSONB DEFAULT '[]'::jsonb,
    gamification  JSONB DEFAULT '{"totalXP":0,"xpLog":[],"earnedBadgeIds":[]}'::jsonb,
    envelopes     JSONB DEFAULT '{"enabled":false,"rules":[]}'::jsonb,
    version       INTEGER DEFAULT 1,
    created_at    TIMESTAMPTZ DEFAULT now(),
    updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS goals (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name           TEXT NOT NULL DEFAULT '',
    description    TEXT DEFAULT '',
    target_amount  NUMERIC(15,2) DEFAULT 0,
    current_amount NUMERIC(15,2) DEFAULT 0,
    deadline       DATE,
    priority       TEXT DEFAULT 'medium',
    color          TEXT DEFAULT '#00e5c3',
    image_url      TEXT,
    is_deleted     BOOLEAN DEFAULT false,
    version        INTEGER DEFAULT 1,
    created_at     TIMESTAMPTZ DEFAULT now(),
    updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transactions (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type           TEXT NOT NULL DEFAULT 'gasto',
    amount         NUMERIC(15,2) NOT NULL DEFAULT 0,
    category       TEXT DEFAULT '',
    note           TEXT DEFAULT '',
    date           DATE DEFAULT CURRENT_DATE,
    goal_id        UUID,
    decision_type  TEXT,
    is_deleted     BOOLEAN DEFAULT false,
    version        INTEGER DEFAULT 1,
    created_at     TIMESTAMPTZ DEFAULT now(),
    updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS routines (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL DEFAULT '',
    objective       TEXT DEFAULT '',
    category        TEXT DEFAULT 'finanzas',
    frequency       TEXT DEFAULT 'daily',
    difficulty      TEXT DEFAULT 'medium',
    xp_value        INTEGER DEFAULT 20,
    completed_dates JSONB DEFAULT '[]'::jsonb,
    streak          INTEGER DEFAULT 0,
    is_deleted      BOOLEAN DEFAULT false,
    version         INTEGER DEFAULT 1,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- STEP 2: Add missing columns to existing tables
-- (safe — does nothing if column already exists)
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS envelopes JSONB DEFAULT '{"enabled":false,"rules":[]}'::jsonb;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE goals ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE goals ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS decision_type TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE routines ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE routines ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE routines ADD COLUMN IF NOT EXISTS objective TEXT DEFAULT '';
ALTER TABLE routines ADD COLUMN IF NOT EXISTS difficulty TEXT DEFAULT 'medium';
ALTER TABLE routines ADD COLUMN IF NOT EXISTS xp_value INTEGER DEFAULT 20;
ALTER TABLE routines ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE routines ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- ============================================================
-- STEP 3: RLS Policies
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE routines ENABLE ROW LEVEL SECURITY;

-- Drop OLD Spanish-named policies from previous setup
DROP POLICY IF EXISTS "Users own their profile" ON profiles;
DROP POLICY IF EXISTS "Users own their goals" ON goals;
DROP POLICY IF EXISTS "Users own their transactions" ON transactions;
DROP POLICY IF EXISTS "Users own their routines" ON routines;
DROP POLICY IF EXISTS "Los usuarios son propietarios de sus objetivos" ON goals;
DROP POLICY IF EXISTS "Los usuarios son propietarios de sus transacciones" ON transactions;
DROP POLICY IF EXISTS "Los usuarios son propietarios de sus rutinas" ON routines;
DROP POLICY IF EXISTS "Los usuarios son propietarios de su perfil" ON profiles;

-- Drop new-named policies (in case re-running)
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_delete" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "profiles_delete" ON profiles FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "goals_select" ON goals;
DROP POLICY IF EXISTS "goals_insert" ON goals;
DROP POLICY IF EXISTS "goals_update" ON goals;
DROP POLICY IF EXISTS "goals_delete" ON goals;
CREATE POLICY "goals_select" ON goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "goals_insert" ON goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "goals_update" ON goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "goals_delete" ON goals FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "transactions_select" ON transactions;
DROP POLICY IF EXISTS "transactions_insert" ON transactions;
DROP POLICY IF EXISTS "transactions_update" ON transactions;
DROP POLICY IF EXISTS "transactions_delete" ON transactions;
CREATE POLICY "transactions_select" ON transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "transactions_insert" ON transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "transactions_update" ON transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "transactions_delete" ON transactions FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "routines_select" ON routines;
DROP POLICY IF EXISTS "routines_insert" ON routines;
DROP POLICY IF EXISTS "routines_update" ON routines;
DROP POLICY IF EXISTS "routines_delete" ON routines;
CREATE POLICY "routines_select" ON routines FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "routines_insert" ON routines FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "routines_update" ON routines FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "routines_delete" ON routines FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- STEP 4: Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_updated ON goals(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_tx_updated ON transactions(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_routines_user ON routines(user_id);
CREATE INDEX IF NOT EXISTS idx_routines_updated ON routines(user_id, updated_at);

-- ============================================================
-- STEP 5: Auto-version trigger (AFTER columns exist)
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    NEW.version = COALESCE(OLD.version, 0) + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS goals_updated_at ON goals;
CREATE TRIGGER goals_updated_at BEFORE UPDATE ON goals FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS transactions_updated_at ON transactions;
CREATE TRIGGER transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS routines_updated_at ON routines;
CREATE TRIGGER routines_updated_at BEFORE UPDATE ON routines FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- STEP 6: Enable Realtime
-- ============================================================

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE goals; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE transactions; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE routines; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE profiles; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ============================================================
-- STEP 7: Auto-create profile on signup
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (user_id, name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', ''))
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- DONE ✅
-- ============================================================
