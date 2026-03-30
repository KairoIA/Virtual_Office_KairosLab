-- ═══════════════════════════════════════════════════════
-- KAIROS LAB — V3 Schema: Memory, Lists, Diary, Content, Recurring
-- Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

-- Persistent memory (facts Kaira remembers forever)
CREATE TABLE IF NOT EXISTS kaira_memory (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category    TEXT NOT NULL DEFAULT 'fact',
    key         TEXT NOT NULL,
    value       TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Custom lists (shopping, packing, ideas, etc.)
CREATE TABLE IF NOT EXISTS lists (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS list_items (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    list_id     UUID REFERENCES lists(id) ON DELETE CASCADE,
    text        TEXT NOT NULL,
    done        BOOLEAN DEFAULT false,
    position    INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- Activity log / diary
CREATE TABLE IF NOT EXISTS activity_log (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    activity    TEXT NOT NULL,
    category    TEXT DEFAULT 'General',
    date_key    DATE DEFAULT CURRENT_DATE,
    notes       TEXT DEFAULT '',
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- Saved content (links, posts, videos from social media)
CREATE TABLE IF NOT EXISTS saved_content (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title       TEXT NOT NULL,
    url         TEXT DEFAULT '',
    topic       TEXT DEFAULT 'General',
    source      TEXT DEFAULT '',
    notes       TEXT DEFAULT '',
    reviewed    BOOLEAN DEFAULT false,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- Recurring reminders
CREATE TABLE IF NOT EXISTS recurring_reminders (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    text            TEXT NOT NULL,
    frequency       TEXT NOT NULL DEFAULT 'weekly',
    day_of_week     INTEGER,
    day_of_month    INTEGER,
    last_triggered  DATE,
    active          BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_memory_category ON kaira_memory(category);
CREATE INDEX IF NOT EXISTS idx_memory_key ON kaira_memory(key);
CREATE INDEX IF NOT EXISTS idx_list_items_list ON list_items(list_id);
CREATE INDEX IF NOT EXISTS idx_activity_date ON activity_log(date_key);
CREATE INDEX IF NOT EXISTS idx_activity_category ON activity_log(category);
CREATE INDEX IF NOT EXISTS idx_content_topic ON saved_content(topic);
CREATE INDEX IF NOT EXISTS idx_content_reviewed ON saved_content(reviewed) WHERE reviewed = false;
CREATE INDEX IF NOT EXISTS idx_recurring_active ON recurring_reminders(active) WHERE active = true;

-- Auto-update trigger for memory
DROP TRIGGER IF EXISTS memory_updated_at ON kaira_memory;
CREATE TRIGGER memory_updated_at
    BEFORE UPDATE ON kaira_memory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
