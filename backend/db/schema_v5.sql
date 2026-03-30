-- ── V5: Deadlines on tasks/projects, completed_at on tasks ──

-- Tasks: add deadline
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deadline DATE;

-- Projects: add deadline
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deadline DATE;
