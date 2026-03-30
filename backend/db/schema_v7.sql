-- ── V7: Day Sessions (structured daily plan) + Project Notes ──

-- Day Sessions: 4 fixed time blocks per day
CREATE TABLE IF NOT EXISTS day_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date_key DATE NOT NULL DEFAULT CURRENT_DATE,
    slot TEXT NOT NULL CHECK (slot IN ('morning', 'afternoon', 'evening', 'night')),
    domain TEXT NOT NULL CHECK (domain IN ('Trading', 'Dev', 'Bets', 'IA', 'Personal', 'Estudio')),
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    focus_text TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(date_key, slot)
);

CREATE INDEX IF NOT EXISTS idx_day_sessions_date ON day_sessions(date_key);

-- Project Notes: mini-journal per project
CREATE TABLE IF NOT EXISTS project_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_notes_project ON project_notes(project_id);
