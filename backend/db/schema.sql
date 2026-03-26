-- ═══════════════════════════════════════════════════════
-- KAIROS LAB — Supabase Schema
-- Run this in your Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

-- Journal entries (one per day)
CREATE TABLE IF NOT EXISTS journal (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date_key    DATE NOT NULL UNIQUE,
    content     TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Reminders with due dates
CREATE TABLE IF NOT EXISTS reminders (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    text        TEXT NOT NULL,
    due_date    DATE,
    done        BOOLEAN DEFAULT false,
    position    INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- General tasks (backlog)
CREATE TABLE IF NOT EXISTS tasks (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    text        TEXT NOT NULL,
    done        BOOLEAN DEFAULT false,
    position    INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- Completed history
CREATE TABLE IF NOT EXISTS completed (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    text        TEXT NOT NULL,
    completed_date DATE NOT NULL DEFAULT CURRENT_DATE,
    type        TEXT NOT NULL CHECK (type IN ('Reminder', 'Task')),
    duration    TEXT DEFAULT '',
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_journal_date ON journal(date_key);
CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(due_date) WHERE done = false;
CREATE INDEX IF NOT EXISTS idx_completed_date ON completed(completed_date);

-- Auto-update updated_at on journal
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS journal_updated_at ON journal;
CREATE TRIGGER journal_updated_at
    BEFORE UPDATE ON journal
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
