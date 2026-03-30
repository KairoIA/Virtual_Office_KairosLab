-- ── V6: Optional time for reminders + notification tracking ──

-- Add optional time to reminders (HH:MM format stored as TIME)
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS due_time TIME;

-- Track which reminders already got their 30-min alert
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS alert_sent BOOLEAN DEFAULT false;
