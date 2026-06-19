/**
 * SQLite Client — Drop-in replacement for Supabase JS client
 * Implements the same chainable query builder API:
 *   supabase.from('table').select('cols').eq('col', val).order('col').limit(n).single()
 *
 * Supports: select, insert, update, delete, upsert
 * Filters: eq, neq, gt, gte, lt, lte, in, is, ilike, not
 * Modifiers: order, limit, single
 * Relations: parent (FK on this table) and children (FK on other table)
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { createTables } from './sqlite-schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'kairos_offline.db');

// ── Relationship definitions ─────────────────────────
// Maps "sourceTable.relatedTable" → how to join
const RELATIONS = {
    // Parent relations (FK on source table → related table)
    'day_sessions.projects':    { table: 'projects', fk: 'project_id', type: 'parent' },
    'daily_plan.projects':      { table: 'projects', fk: 'project_id', type: 'parent' },
    'notes.projects':           { table: 'projects', fk: 'project_id', type: 'parent' },
    'tasks.projects':           { table: 'projects', fk: 'project_id', type: 'parent' },
    'reminders.projects':       { table: 'projects', fk: 'project_id', type: 'parent' },
    'project_notes.projects':   { table: 'projects', fk: 'project_id', type: 'parent' },
    'journal.projects':         { table: 'projects', fk: 'project_id', type: 'parent' },
    // Children relations (FK on child table → this table)
    'lists.list_items':         { table: 'list_items', fk: 'list_id', type: 'children' },
};

// Boolean columns (SQLite stores as 0/1, Supabase returns true/false)
const BOOL_COLS = new Set([
    'done', 'processed', 'reviewed', 'active', 'pinned', 'alert_sent'
]);

// ── Initialize database ──────────────────────────────
import fs from 'fs';
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
createTables(db);

// ── Helper: convert SQLite row booleans ──────────────
function convertBools(row) {
    if (!row) return row;
    for (const key of Object.keys(row)) {
        if (BOOL_COLS.has(key) && row[key] !== null) {
            row[key] = row[key] === 1 || row[key] === true;
        }
    }
    return row;
}

// ── Helper: convert JS booleans to SQLite integers ───
function boolToInt(value, key) {
    if (BOOL_COLS.has(key) && typeof value === 'boolean') {
        return value ? 1 : 0;
    }
    return value;
}

// ── Query Builder ────────────────────────────────────
class QueryBuilder {
    constructor(tableName) {
        this._table = tableName;
        this._operation = null;     // 'select' | 'insert' | 'update' | 'delete' | 'upsert'
        this._selectCols = '*';
        this._relations = [];       // parsed relation requests
        this._filters = [];         // { col, op, val }
        this._orders = [];          // { col, ascending }
        this._limitN = null;
        this._single = false;
        this._insertData = null;
        this._updateData = null;
        this._upsertConflict = null;
        this._returnData = false;   // whether to return data after insert/update/delete
    }

    // ── Operations ───────────────────────────────────

    select(cols = '*') {
        this._operation = 'select';
        this._parseSelect(cols);
        return this;
    }

    insert(data) {
        this._operation = 'insert';
        this._insertData = Array.isArray(data) ? data : [data];
        return this;
    }

    update(data) {
        this._operation = 'update';
        this._updateData = data;
        return this;
    }

    delete() {
        this._operation = 'delete';
        return this;
    }

    upsert(data, opts = {}) {
        this._operation = 'upsert';
        this._insertData = Array.isArray(data) ? data : [data];
        this._upsertConflict = opts.onConflict || null;
        return this;
    }

    // ── Filters ──────────────────────────────────────

    eq(col, val)   { this._filters.push({ col, op: '=', val: boolToInt(val, col) }); return this; }
    neq(col, val)  { this._filters.push({ col, op: '!=', val: boolToInt(val, col) }); return this; }
    gt(col, val)   { this._filters.push({ col, op: '>', val }); return this; }
    gte(col, val)  { this._filters.push({ col, op: '>=', val }); return this; }
    lt(col, val)   { this._filters.push({ col, op: '<', val }); return this; }
    lte(col, val)  { this._filters.push({ col, op: '<=', val }); return this; }

    in(col, vals)  { this._filters.push({ col, op: 'IN', val: vals }); return this; }
    is(col, val)   {
        if (val === null) this._filters.push({ col, op: 'IS NULL', val: null });
        else this._filters.push({ col, op: '=', val: boolToInt(val, col) });
        return this;
    }

    ilike(col, val) {
        // Supabase ilike: %text% → SQLite LIKE (case-insensitive by default for ASCII)
        this._filters.push({ col, op: 'LIKE', val });
        return this;
    }

    not(col, op, val) {
        if (op === 'is' && val === null) {
            this._filters.push({ col, op: 'IS NOT NULL', val: null });
        } else if (op === 'in') {
            this._filters.push({ col, op: 'NOT IN', val });
        } else {
            this._filters.push({ col, op: `NOT ${op}`, val });
        }
        return this;
    }

    // ── Modifiers ────────────────────────────────────

    order(col, opts = {}) {
        const ascending = opts.ascending !== undefined ? opts.ascending : true;
        this._orders.push({ col, ascending });
        return this;
    }

    limit(n) {
        this._limitN = n;
        return this;
    }

    single() {
        this._single = true;
        this._limitN = 1;
        return this;
    }

    // After insert/update/upsert, chain .select() to return data
    // Supabase pattern: .insert(row).select().single()
    // We detect this by checking if _operation is already set
    _chainSelect() {
        this._returnData = true;
        return this;
    }

    // ── Parse select string ──────────────────────────

    _parseSelect(selectStr) {
        if (!selectStr || selectStr === '*') {
            this._selectCols = '*';
            return;
        }

        // Parse relations: "colA, colB, relTable(col1, col2)" or "*, projects(name)"
        // Also handle alias syntax: "projects:project_id(name)"
        const cols = [];
        let depth = 0;
        let current = '';

        for (const ch of selectStr) {
            if (ch === '(') depth++;
            if (ch === ')') depth--;
            if (ch === ',' && depth === 0) {
                cols.push(current.trim());
                current = '';
            } else {
                current += ch;
            }
        }
        if (current.trim()) cols.push(current.trim());

        const plainCols = [];
        for (const col of cols) {
            const relMatch = col.match(/^(\w+)(?::(\w+))?\((.+)\)$/);
            if (relMatch) {
                const [, relName, explicitFk, relCols] = relMatch;
                this._relations.push({
                    name: relName,
                    fk: explicitFk || null,
                    cols: relCols.split(',').map(c => c.trim()),
                });
            } else {
                plainCols.push(col);
            }
        }

        this._selectCols = plainCols.length ? plainCols.join(', ') : '*';
    }

    // ── Build WHERE clause ───────────────────────────

    _buildWhere() {
        if (!this._filters.length) return { clause: '', params: [] };

        const parts = [];
        const params = [];

        for (const f of this._filters) {
            if (f.op === 'IS NULL') {
                parts.push(`"${f.col}" IS NULL`);
            } else if (f.op === 'IS NOT NULL') {
                parts.push(`"${f.col}" IS NOT NULL`);
            } else if (f.op === 'IN' || f.op === 'NOT IN') {
                const placeholders = f.val.map(() => '?').join(', ');
                parts.push(`"${f.col}" ${f.op} (${placeholders})`);
                params.push(...f.val.map(v => boolToInt(v, f.col)));
            } else if (f.op === 'LIKE') {
                parts.push(`"${f.col}" LIKE ? COLLATE NOCASE`);
                params.push(f.val);
            } else {
                parts.push(`"${f.col}" ${f.op} ?`);
                params.push(f.val);
            }
        }

        return { clause: 'WHERE ' + parts.join(' AND '), params };
    }

    // ── Build ORDER BY ───────────────────────────────

    _buildOrderBy() {
        if (!this._orders.length) return '';
        return 'ORDER BY ' + this._orders
            .map(o => `"${o.col}" ${o.ascending ? 'ASC' : 'DESC'}`)
            .join(', ');
    }

    // ── Resolve relations for result rows ────────────

    _resolveRelations(rows) {
        if (!this._relations.length) return rows;

        for (const rel of this._relations) {
            const relKey = `${this._table}.${rel.name}`;
            const relDef = RELATIONS[relKey];

            if (!relDef) {
                // Unknown relation — just add null
                for (const row of rows) row[rel.name] = null;
                continue;
            }

            if (relDef.type === 'parent') {
                // FK on this table → fetch single parent row
                const fkCol = rel.fk || relDef.fk;
                const colList = rel.cols.map(c => `"${c}"`).join(', ');
                const stmt = db.prepare(`SELECT ${colList} FROM "${relDef.table}" WHERE id = ?`);

                for (const row of rows) {
                    const fkVal = row[fkCol];
                    if (fkVal) {
                        const parent = stmt.get(fkVal);
                        row[rel.name] = parent ? convertBools(parent) : null;
                    } else {
                        row[rel.name] = null;
                    }
                }
            } else if (relDef.type === 'children') {
                // FK on child table → fetch array of children
                const colList = rel.cols.map(c => `"${c}"`).join(', ');
                const stmt = db.prepare(
                    `SELECT ${colList} FROM "${relDef.table}" WHERE "${relDef.fk}" = ? ORDER BY "position" ASC`
                );

                for (const row of rows) {
                    const children = stmt.all(row.id);
                    row[rel.name] = children.map(c => convertBools(c));
                }
            }
        }

        return rows;
    }

    // ── Execute ──────────────────────────────────────

    _execute() {
        try {
            switch (this._operation) {
                case 'select': return this._execSelect();
                case 'insert': return this._execInsert();
                case 'update': return this._execUpdate();
                case 'delete': return this._execDelete();
                case 'upsert': return this._execUpsert();
                default: return { data: null, error: { message: 'No operation specified' } };
            }
        } catch (err) {
            return { data: null, error: { message: err.message, code: err.code || 'SQLITE_ERROR' } };
        }
    }

    _execSelect() {
        const { clause, params } = this._buildWhere();
        const orderBy = this._buildOrderBy();
        const limitStr = this._limitN ? `LIMIT ${this._limitN}` : '';

        const sql = `SELECT ${this._selectCols} FROM "${this._table}" ${clause} ${orderBy} ${limitStr}`;
        let rows = db.prepare(sql).all(...params);
        rows = rows.map(r => convertBools(r));
        rows = this._resolveRelations(rows);

        if (this._single) {
            if (rows.length === 0) {
                return { data: null, error: { message: 'Row not found', code: 'PGRST116' } };
            }
            return { data: rows[0], error: null };
        }

        return { data: rows, error: null };
    }

    _execInsert() {
        const results = [];
        for (const row of this._insertData) {
            const id = row.id || randomUUID();
            const rowWithId = { id, ...row };

            // Convert booleans
            for (const key of Object.keys(rowWithId)) {
                rowWithId[key] = boolToInt(rowWithId[key], key);
                if (rowWithId[key] === undefined) rowWithId[key] = null;
            }

            const cols = Object.keys(rowWithId);
            const placeholders = cols.map(() => '?').join(', ');
            const sql = `INSERT INTO "${this._table}" (${cols.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders})`;
            db.prepare(sql).run(...cols.map(k => rowWithId[k]));

            // Fetch the inserted row
            const inserted = db.prepare(`SELECT * FROM "${this._table}" WHERE id = ?`).get(id);
            results.push(convertBools(inserted));
        }

        if (this._returnData) {
            if (this._single) return { data: results[0] || null, error: null };
            return { data: results, error: null };
        }
        if (this._single) return { data: results[0] || null, error: null };
        return { data: results, error: null };
    }

    _execUpdate() {
        const setCols = Object.keys(this._updateData);
        if (!setCols.length) return { data: null, error: null };

        const setClause = setCols.map(c => `"${c}" = ?`).join(', ');
        const setParams = setCols.map(c => boolToInt(this._updateData[c], c));

        // Auto-update updated_at if column exists
        const tableInfo = db.prepare(`PRAGMA table_info("${this._table}")`).all();
        const hasUpdatedAt = tableInfo.some(c => c.name === 'updated_at');
        const extraSet = hasUpdatedAt ? `, "updated_at" = datetime('now')` : '';

        const { clause, params } = this._buildWhere();
        const sql = `UPDATE "${this._table}" SET ${setClause}${extraSet} ${clause}`;
        db.prepare(sql).run(...setParams, ...params);

        // If returning data, fetch updated rows
        if (this._returnData || this._single) {
            const selectSql = `SELECT * FROM "${this._table}" ${clause} ${this._buildOrderBy()} ${this._limitN ? 'LIMIT ' + this._limitN : ''}`;
            let rows = db.prepare(selectSql).all(...params).map(r => convertBools(r));
            rows = this._resolveRelations(rows);
            if (this._single) {
                return { data: rows[0] || null, error: null };
            }
            return { data: rows, error: null };
        }

        return { data: null, error: null };
    }

    _execDelete() {
        const { clause, params } = this._buildWhere();
        const sql = `DELETE FROM "${this._table}" ${clause}`;
        db.prepare(sql).run(...params);
        return { data: null, error: null };
    }

    _execUpsert() {
        const results = [];
        for (const row of this._insertData) {
            const id = row.id || randomUUID();
            const rowWithId = { id, ...row };

            for (const key of Object.keys(rowWithId)) {
                rowWithId[key] = boolToInt(rowWithId[key], key);
                if (rowWithId[key] === undefined) rowWithId[key] = null;
            }

            const cols = Object.keys(rowWithId);
            const placeholders = cols.map(() => '?').join(', ');
            const conflictCol = this._upsertConflict || 'id';
            const updateCols = cols.filter(c => c !== conflictCol && c !== 'id');
            const updateClause = updateCols.map(c => `"${c}" = excluded."${c}"`).join(', ');

            const sql = `INSERT INTO "${this._table}" (${cols.map(c => `"${c}"`).join(', ')})
                VALUES (${placeholders})
                ON CONFLICT("${conflictCol}") DO UPDATE SET ${updateClause}`;

            db.prepare(sql).run(...cols.map(k => rowWithId[k]));

            // Fetch the upserted row
            let fetchSql;
            if (conflictCol !== 'id') {
                fetchSql = `SELECT * FROM "${this._table}" WHERE "${conflictCol}" = ?`;
                const result = db.prepare(fetchSql).get(rowWithId[conflictCol]);
                results.push(convertBools(result));
            } else {
                fetchSql = `SELECT * FROM "${this._table}" WHERE id = ?`;
                const result = db.prepare(fetchSql).get(id);
                results.push(convertBools(result));
            }
        }

        if (this._single) return { data: results[0] || null, error: null };
        return { data: results, error: null };
    }

    // ── Thenable (makes builder awaitable) ───────────

    then(resolve, reject) {
        try {
            const result = this._execute();
            resolve(result);
        } catch (err) {
            if (reject) reject(err);
            else resolve({ data: null, error: { message: err.message } });
        }
    }
}

// ── Proxy to handle .select() chaining after insert/update/upsert ──
// Supabase: .insert(row).select().single()
// We intercept the second .select() call

function createProxy(builder) {
    return new Proxy(builder, {
        get(target, prop) {
            if (prop === 'select' && target._operation && target._operation !== 'select') {
                // This is .insert().select() or .update().select() — just enable return data
                return function(cols) {
                    target._returnData = true;
                    if (cols && cols !== '*') target._parseSelect(cols);
                    return createProxy(target);
                };
            }
            if (prop === 'then') {
                return target.then.bind(target);
            }
            const val = target[prop];
            if (typeof val === 'function') {
                return function(...args) {
                    const result = val.apply(target, args);
                    return result === target ? createProxy(target) : result;
                };
            }
            return val;
        }
    });
}

// ── Query counter (same interface as original supabase.js) ──
const queryLog = {};
let queryTotal = 0;
const startTime = Date.now();

// ── Public API (mirrors Supabase client) ─────────────
const sqliteClient = {
    from(table) {
        queryLog[table] = (queryLog[table] || 0) + 1;
        queryTotal++;
        const builder = new QueryBuilder(table);
        return createProxy(builder);
    }
};

export function getQueryStats() {
    const uptimeMin = Math.round((Date.now() - startTime) / 60000);
    const sorted = Object.entries(queryLog).sort((a, b) => b[1] - a[1]);
    return {
        uptime_min: uptimeMin,
        queries_total: queryTotal,
        queries_per_min: uptimeMin > 0 ? +(queryTotal / uptimeMin).toFixed(2) : queryTotal,
        by_table: Object.fromEntries(sorted),
        mode: 'sqlite_offline',
    };
}

export function getDb() { return db; }

export default sqliteClient;
