-- ── V8: Completion timestamps for inbox and saved_content ──

ALTER TABLE inbox ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;
ALTER TABLE saved_content ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
