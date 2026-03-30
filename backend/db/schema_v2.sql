-- ═══════════════════════════════════════════════════════
-- KAIROS LAB — V2 Schema Update
-- Run this in your Supabase SQL Editor AFTER v1 schema
-- ═══════════════════════════════════════════════════════

-- Projects
CREATE TABLE IF NOT EXISTS projects (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name        TEXT NOT NULL,
    domain      TEXT NOT NULL DEFAULT 'Personal',
    status      TEXT NOT NULL DEFAULT 'active',
    objective   TEXT DEFAULT '',
    next_action TEXT DEFAULT '',
    notes       TEXT DEFAULT '',
    position    INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Inbox (quick capture, unprocessed items)
CREATE TABLE IF NOT EXISTS inbox (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    text        TEXT NOT NULL,
    processed   BOOLEAN DEFAULT false,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- Daily Top 3 priorities
CREATE TABLE IF NOT EXISTS daily_top3 (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date_key    DATE NOT NULL,
    slot        INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 3),
    text        TEXT NOT NULL,
    energy      TEXT DEFAULT 'quick',
    done        BOOLEAN DEFAULT false,
    created_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE(date_key, slot)
);

-- Add project_id to existing tables (optional FK)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reminders' AND column_name='project_id') THEN
        ALTER TABLE reminders ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='project_id') THEN
        ALTER TABLE tasks ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_domain ON projects(domain);
CREATE INDEX IF NOT EXISTS idx_inbox_processed ON inbox(processed) WHERE processed = false;
CREATE INDEX IF NOT EXISTS idx_top3_date ON daily_top3(date_key);
CREATE INDEX IF NOT EXISTS idx_reminders_project ON reminders(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);

-- Auto-update updated_at on projects
DROP TRIGGER IF EXISTS projects_updated_at ON projects;
CREATE TRIGGER projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
