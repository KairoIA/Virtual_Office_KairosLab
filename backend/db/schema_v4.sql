-- ═══════════════════════════════════════════════════════
-- KAIROS LAB — V4 Schema: Daily Plan, Notes, Priorities
-- Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

-- ── Daily Plan (replaces daily_top3, up to 10 items) ──
DROP TABLE IF EXISTS daily_top3;

CREATE TABLE IF NOT EXISTS daily_plan (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date_key    DATE NOT NULL,
    slot        INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 10),
    text        TEXT NOT NULL,
    category    TEXT DEFAULT 'General',
    project_id  UUID REFERENCES projects(id) ON DELETE SET NULL,
    energy      TEXT DEFAULT 'quick',
    priority    TEXT DEFAULT NULL CHECK (priority IN ('green', 'yellow', 'red', NULL)),
    done        BOOLEAN DEFAULT false,
    source      TEXT DEFAULT 'manual',
    created_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE(date_key, slot)
);

-- ── Notes / Post-its ──────────────────────────────────
CREATE TABLE IF NOT EXISTS notes (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    text        TEXT NOT NULL,
    category    TEXT NOT NULL DEFAULT 'General',
    project_id  UUID REFERENCES projects(id) ON DELETE SET NULL,
    color       TEXT DEFAULT 'cyan',
    pinned      BOOLEAN DEFAULT false,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ── Add priority to reminders and tasks ───────────────
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reminders' AND column_name='priority') THEN
        ALTER TABLE reminders ADD COLUMN priority TEXT DEFAULT NULL CHECK (priority IN ('green', 'yellow', 'red'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='priority') THEN
        ALTER TABLE tasks ADD COLUMN priority TEXT DEFAULT NULL CHECK (priority IN ('green', 'yellow', 'red'));
    END IF;
END $$;

-- ── Add category to reminders and tasks ───────────────
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reminders' AND column_name='category') THEN
        ALTER TABLE reminders ADD COLUMN category TEXT DEFAULT 'General';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='category') THEN
        ALTER TABLE tasks ADD COLUMN category TEXT DEFAULT 'General';
    END IF;
END $$;

-- ── Add category + project_id to journal ──────────────
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='journal' AND column_name='category') THEN
        ALTER TABLE journal ADD COLUMN category TEXT DEFAULT 'General';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='journal' AND column_name='project_id') THEN
        ALTER TABLE journal ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ── Add completed_at to projects ──────────────────────
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='completed_at') THEN
        ALTER TABLE projects ADD COLUMN completed_at TIMESTAMPTZ DEFAULT NULL;
    END IF;
END $$;

-- ── Indexes ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_daily_plan_date ON daily_plan(date_key);
CREATE INDEX IF NOT EXISTS idx_notes_category ON notes(category);
CREATE INDEX IF NOT EXISTS idx_notes_project ON notes(project_id);
CREATE INDEX IF NOT EXISTS idx_reminders_category ON reminders(category);
CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category);
CREATE INDEX IF NOT EXISTS idx_journal_project ON journal(project_id);
CREATE INDEX IF NOT EXISTS idx_journal_category ON journal(category);

-- Auto-update trigger for notes
DROP TRIGGER IF EXISTS notes_updated_at ON notes;
CREATE TRIGGER notes_updated_at
    BEFORE UPDATE ON notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
