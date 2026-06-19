/**
 * Keep-Alive — Pings Supabase every 6h to prevent free-tier pause.
 * Free tier auto-pauses projects after ~7 days without queries.
 */

import cron from 'node-cron';
import supabase from '../db/supabase.js';

async function ping() {
    try {
        const { error } = await supabase.from('projects').select('id').limit(1);
        if (error) {
            console.error('[KEEPALIVE] Ping failed:', error.message);
        } else {
            console.log(`[KEEPALIVE] Ping OK ${new Date().toISOString()}`);
        }
    } catch (err) {
        console.error('[KEEPALIVE] Ping error:', err.message);
    }
}

export function startKeepAlive() {
    cron.schedule('0 12 * * *', ping, { timezone: 'Europe/Madrid' });
    console.log('[KEEPALIVE] Cron scheduled daily at 12:00 Europe/Madrid');
    ping();
}
