-- KAIROS LAB — Expenses table
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS expenses (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    concept     TEXT NOT NULL,
    amount      DECIMAL(10,2) NOT NULL,
    category    TEXT NOT NULL DEFAULT 'General',
    date_key    DATE NOT NULL DEFAULT CURRENT_DATE,
    notes       TEXT DEFAULT '',
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date_key);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
