/**
 * SQLite Schema — mirrors all Supabase tables
 * Used as offline fallback when Supabase is restricted
 */

export function createTables(db) {
    db.exec(`
        -- Journal entries (one per day)
        CREATE TABLE IF NOT EXISTS journal (
            id TEXT PRIMARY KEY,
            date_key TEXT NOT NULL UNIQUE,
            content TEXT NOT NULL DEFAULT '',
            category TEXT DEFAULT 'General',
            project_id TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );

        -- Reminders
        CREATE TABLE IF NOT EXISTS reminders (
            id TEXT PRIMARY KEY,
            text TEXT NOT NULL,
            due_date TEXT,
            due_time TEXT,
            done INTEGER DEFAULT 0,
            position INTEGER DEFAULT 0,
            category TEXT DEFAULT 'General',
            priority TEXT,
            project_id TEXT,
            alert_sent INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        );

        -- Tasks
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            text TEXT NOT NULL,
            done INTEGER DEFAULT 0,
            position INTEGER DEFAULT 0,
            deadline TEXT,
            category TEXT DEFAULT 'General',
            priority TEXT,
            project_id TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );

        -- Completed history
        CREATE TABLE IF NOT EXISTS completed (
            id TEXT PRIMARY KEY,
            text TEXT NOT NULL,
            completed_date TEXT NOT NULL DEFAULT (date('now')),
            type TEXT NOT NULL,
            duration TEXT DEFAULT '',
            category TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );

        -- Projects
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            domain TEXT NOT NULL DEFAULT 'Personal',
            status TEXT NOT NULL DEFAULT 'active',
            objective TEXT DEFAULT '',
            next_action TEXT DEFAULT '',
            notes TEXT DEFAULT '',
            project_type TEXT DEFAULT 'temporal',
            position INTEGER DEFAULT 0,
            deadline TEXT,
            completed_at TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );

        -- Inbox
        CREATE TABLE IF NOT EXISTS inbox (
            id TEXT PRIMARY KEY,
            text TEXT NOT NULL,
            processed INTEGER DEFAULT 0,
            processed_at TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );

        -- Daily Plan
        CREATE TABLE IF NOT EXISTS daily_plan (
            id TEXT PRIMARY KEY,
            date_key TEXT NOT NULL,
            slot INTEGER NOT NULL,
            text TEXT NOT NULL,
            category TEXT DEFAULT 'General',
            project_id TEXT,
            energy TEXT DEFAULT 'quick',
            priority TEXT,
            done INTEGER DEFAULT 0,
            source TEXT DEFAULT 'manual',
            created_at TEXT DEFAULT (datetime('now')),
            UNIQUE(date_key, slot)
        );

        -- Kaira Memory
        CREATE TABLE IF NOT EXISTS kaira_memory (
            id TEXT PRIMARY KEY,
            category TEXT NOT NULL DEFAULT 'fact',
            key TEXT NOT NULL,
            value TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );

        -- Lists
        CREATE TABLE IF NOT EXISTS lists (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            created_at TEXT DEFAULT (datetime('now'))
        );

        -- List Items
        CREATE TABLE IF NOT EXISTS list_items (
            id TEXT PRIMARY KEY,
            list_id TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
            text TEXT NOT NULL,
            done INTEGER DEFAULT 0,
            position INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        );

        -- Activity Log
        CREATE TABLE IF NOT EXISTS activity_log (
            id TEXT PRIMARY KEY,
            activity TEXT NOT NULL,
            category TEXT DEFAULT 'General',
            date_key TEXT DEFAULT (date('now')),
            notes TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now'))
        );

        -- Saved Content (Watch Later)
        CREATE TABLE IF NOT EXISTS saved_content (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            url TEXT DEFAULT '',
            topic TEXT DEFAULT 'General',
            source TEXT DEFAULT '',
            notes TEXT DEFAULT '',
            reviewed INTEGER DEFAULT 0,
            reviewed_at TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );

        -- Recurring Reminders
        CREATE TABLE IF NOT EXISTS recurring_reminders (
            id TEXT PRIMARY KEY,
            text TEXT NOT NULL,
            frequency TEXT NOT NULL DEFAULT 'weekly',
            day_of_week INTEGER,
            day_of_month INTEGER,
            last_triggered TEXT,
            active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT (datetime('now'))
        );

        -- Expenses
        CREATE TABLE IF NOT EXISTS expenses (
            id TEXT PRIMARY KEY,
            concept TEXT NOT NULL,
            amount REAL NOT NULL,
            category TEXT NOT NULL DEFAULT 'General',
            date_key TEXT NOT NULL DEFAULT (date('now')),
            notes TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now'))
        );

        -- Day Sessions
        CREATE TABLE IF NOT EXISTS day_sessions (
            id TEXT PRIMARY KEY,
            date_key TEXT NOT NULL DEFAULT (date('now')),
            slot TEXT NOT NULL,
            domain TEXT NOT NULL,
            project_id TEXT,
            focus_text TEXT,
            position INTEGER DEFAULT 0,
            done INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        );

        -- Notes / Post-its
        CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY,
            text TEXT NOT NULL,
            category TEXT NOT NULL DEFAULT 'General',
            project_id TEXT,
            color TEXT DEFAULT 'cyan',
            pinned INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );

        -- Project Notes
        CREATE TABLE IF NOT EXISTS project_notes (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        );

        -- Indexes
        CREATE INDEX IF NOT EXISTS idx_journal_date ON journal(date_key);
        CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(due_date);
        CREATE INDEX IF NOT EXISTS idx_reminders_project ON reminders(project_id);
        CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
        CREATE INDEX IF NOT EXISTS idx_completed_date ON completed(completed_date);
        CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
        CREATE INDEX IF NOT EXISTS idx_inbox_processed ON inbox(processed);
        CREATE INDEX IF NOT EXISTS idx_daily_plan_date ON daily_plan(date_key);
        CREATE INDEX IF NOT EXISTS idx_memory_category ON kaira_memory(category);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_memory_key ON kaira_memory(key);
        CREATE INDEX IF NOT EXISTS idx_list_items_list ON list_items(list_id);
        CREATE INDEX IF NOT EXISTS idx_activity_date ON activity_log(date_key);
        CREATE INDEX IF NOT EXISTS idx_content_topic ON saved_content(topic);
        CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date_key);
        CREATE INDEX IF NOT EXISTS idx_day_sessions_date ON day_sessions(date_key);
        CREATE INDEX IF NOT EXISTS idx_notes_category ON notes(category);
        CREATE INDEX IF NOT EXISTS idx_project_notes_project ON project_notes(project_id);
    `);

    console.log('[SQLITE] All tables and indexes created');
}
