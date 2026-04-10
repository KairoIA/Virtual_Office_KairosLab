/**
 * Supabase Client
 * Single instance used across all routes
 * Includes query counter for egress debugging
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// ── Query counter for egress debugging ──────────────
const queryLog = {};
let queryTotal = 0;
const startTime = Date.now();

const originalFrom = supabase.from.bind(supabase);
supabase.from = function(table) {
    queryLog[table] = (queryLog[table] || 0) + 1;
    queryTotal++;
    return originalFrom(table);
};

export function getQueryStats() {
    const uptimeMin = Math.round((Date.now() - startTime) / 60000);
    const sorted = Object.entries(queryLog).sort((a, b) => b[1] - a[1]);
    return {
        uptime_min: uptimeMin,
        queries_total: queryTotal,
        queries_per_min: uptimeMin > 0 ? +(queryTotal / uptimeMin).toFixed(2) : queryTotal,
        by_table: Object.fromEntries(sorted),
    };
}

export default supabase;
