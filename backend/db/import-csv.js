/**
 * Import CSV data from Supabase dashboard export into SQLite
 *
 * Usage:
 *   1. Go to Supabase Dashboard → Table Editor
 *   2. For each table, click the "Export to CSV" button
 *   3. Save CSVs to backend/data/import/ folder (name = table name, e.g. projects.csv)
 *   4. Run: node backend/db/import-csv.js
 *
 * Supports all 18 tables. Skips tables that don't have a CSV file.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'kairos_offline.db');
const IMPORT_DIR = path.join(__dirname, '..', 'data', 'import');

// All tables in import order (respecting FK dependencies)
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

// ── CSV Parser (handles quoted fields with commas/newlines) ──
function parseCSV(text) {
    const rows = [];
    let headers = null;
    let current = '';
    let inQuotes = false;
    let fields = [];

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const next = text[i + 1];

        if (inQuotes) {
            if (ch === '"' && next === '"') {
                current += '"';
                i++; // skip escaped quote
            } else if (ch === '"') {
                inQuotes = false;
            } else {
                current += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === ',') {
                fields.push(current);
                current = '';
            } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
                fields.push(current);
                current = '';
                if (ch === '\r') i++; // skip \n after \r

                if (!headers) {
                    headers = fields.map(h => h.trim());
                } else if (fields.some(f => f.trim() !== '')) {
                    const row = {};
                    headers.forEach((h, idx) => {
                        row[h] = fields[idx] !== undefined ? fields[idx] : '';
                    });
                    rows.push(row);
                }
                fields = [];
            } else {
                current += ch;
            }
        }
    }

    // Last row (if file doesn't end with newline)
    if (current || fields.length) {
        fields.push(current);
        if (headers && fields.some(f => f.trim() !== '')) {
            const row = {};
            headers.forEach((h, idx) => {
                row[h] = fields[idx] !== undefined ? fields[idx] : '';
            });
            rows.push(row);
        }
    }

    return { headers, rows };
}

function convertValue(key, val) {
    if (val === '' || val === 'NULL' || val === 'null') return null;
    if (BOOL_COLS.has(key)) {
        if (val === 'true' || val === 't' || val === '1') return 1;
        if (val === 'false' || val === 'f' || val === '0') return 0;
        return val ? 1 : 0;
    }
    return val;
}

// ── Main ─────────────────────────────────────────────
async function main() {
    if (!fs.existsSync(IMPORT_DIR)) {
        fs.mkdirSync(IMPORT_DIR, { recursive: true });
        console.log(`\nCreated import directory: ${IMPORT_DIR}`);
        console.log('Place your Supabase CSV exports there and run this script again.');
        console.log('File names should match table names, e.g. projects.csv, tasks.csv, etc.\n');
        return;
    }

    // Import sqlite-schema to ensure tables exist
    const db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = OFF'); // Disable during import for ordering flexibility

    // Create tables if they don't exist (re-import safe)
    const { createTables } = await import('./sqlite-schema.js');
    createTables(db);

    let totalImported = 0;

    for (const table of TABLES) {
        const csvPath = path.join(IMPORT_DIR, `${table}.csv`);
        if (!fs.existsSync(csvPath)) {
            console.log(`  [SKIP] ${table}.csv not found`);
            continue;
        }

        const csvText = fs.readFileSync(csvPath, 'utf-8');
        const { headers, rows } = parseCSV(csvText);

        if (!rows.length) {
            console.log(`  [SKIP] ${table}.csv is empty`);
            continue;
        }

        // Get valid columns from SQLite table
        const tableInfo = db.prepare(`PRAGMA table_info("${table}")`).all();
        const validCols = new Set(tableInfo.map(c => c.name));

        // Filter headers to only valid columns
        const useCols = headers.filter(h => validCols.has(h));

        // Clear existing data for this table
        db.prepare(`DELETE FROM "${table}"`).run();

        const placeholders = useCols.map(() => '?').join(', ');
        const insertSql = `INSERT OR REPLACE INTO "${table}" (${useCols.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders})`;
        const stmt = db.prepare(insertSql);

        const insertMany = db.transaction((data) => {
            for (const row of data) {
                const vals = useCols.map(col => convertValue(col, row[col]));
                try {
                    stmt.run(...vals);
                } catch (err) {
                    console.log(`    [WARN] ${table} row error: ${err.message}`);
                }
            }
        });

        insertMany(rows);
        console.log(`  [OK] ${table}: ${rows.length} rows imported`);
        totalImported += rows.length;
    }

    db.pragma('foreign_keys = ON');
    db.close();

    console.log(`\n  Total: ${totalImported} rows imported into ${DB_PATH}\n`);
}

// Handle top-level await for dynamic import
(async () => {
    try {
        await main();
    } catch (err) {
        console.error('Import error:', err);
    }
})();
