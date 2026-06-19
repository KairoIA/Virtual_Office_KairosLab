/**
 * Sync SQLite data back to Supabase
 *
 * Run this AFTER Supabase access is restored (after 26-abr-2026)
 * It exports all SQLite data and upserts it into Supabase.
 *
 * Usage: node backend/db/sync-to-supabase.js
 *
 * Strategy:
 *   - For each table, read all rows from SQLite
 *   - Upsert into Supabase (insert or update on conflict)
 *   - This preserves both old Supabase data and new offline data
 */

import { createClient } from '@supabase/supabase-js';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const DB_PATH = path.join(__dirname, '..', 'data', 'kairos_offline.db');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// Tables in dependency order
const TABLES = [
    'projects',
    'journal',
    'reminders',
    'tasks',
    'completed',
    'inbox',
    'daily_plan',
    'kaira_memory',
    'lists',
    'list_items',
    'activity_log',
    'saved_content',
    'recurring_reminders',
    'expenses',
    'day_sessions',
    'notes',
    'project_notes',
];

const BOOL_COLS = new Set([
    'done', 'processed', 'reviewed', 'active', 'pinned', 'alert_sent'
]);

// Unique conflict columns per table (for upsert)
const CONFLICT_COLS = {
    journal: 'date_key',
    daily_plan: 'id',
    lists: 'id',
    kaira_memory: 'id',
};

function convertRow(row) {
    const out = { ...row };
    for (const key of Object.keys(out)) {
        if (BOOL_COLS.has(key)) {
            out[key] = out[key] === 1 || out[key] === true;
        }
    }
    return out;
}

async function main() {
    // Test Supabase connection first
    const { error: testError } = await supabase.from('projects').select('id').limit(1);
    if (testError) {
        console.error('\n  [ERROR] Cannot connect to Supabase:', testError.message);
        console.error('  Make sure Supabase access is restored before running sync.\n');
        process.exit(1);
    }
    console.log('\n  [OK] Supabase connection verified\n');

    const db = new Database(DB_PATH, { readonly: true });
    let totalSynced = 0;

    for (const table of TABLES) {
        let rows;
        try {
            rows = db.prepare(`SELECT * FROM "${table}"`).all();
        } catch (e) {
            console.log(`  [SKIP] ${table}: ${e.message}`);
            continue;
        }

        if (!rows.length) {
            console.log(`  [SKIP] ${table}: empty`);
            continue;
        }

        const converted = rows.map(r => convertRow(r));

        // Upsert in batches of 100
        let synced = 0;
        for (let i = 0; i < converted.length; i += 100) {
            const batch = converted.slice(i, i + 100);
            const conflictCol = CONFLICT_COLS[table] || 'id';
            const { error } = await supabase
                .from(table)
                .upsert(batch, { onConflict: conflictCol });

            if (error) {
                console.log(`  [WARN] ${table} batch ${i}: ${error.message}`);
            } else {
                synced += batch.length;
            }
        }

        console.log(`  [OK] ${table}: ${synced}/${rows.length} rows synced`);
        totalSynced += synced;
    }

    db.close();
    console.log(`\n  Total: ${totalSynced} rows synced to Supabase`);
    console.log('\n  Next steps:');
    console.log('  1. Verify data in Supabase dashboard');
    console.log('  2. Revert to Supabase client: git checkout backend/db/supabase.js');
    console.log('  3. Restart: pm2 restart kairos-backend\n');
}

main().catch(err => {
    console.error('Sync error:', err);
    process.exit(1);
});
