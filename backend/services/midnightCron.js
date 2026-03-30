/**
 * Midnight Cron — Clears day_sessions at 00:00 Madrid time
 */

import supabase from '../db/supabase.js';

function getMsUntilMidnightMadrid() {
    const now = new Date();
    const spainNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
    const h = spainNow.getHours();
    const m = spainNow.getMinutes();
    const s = spainNow.getSeconds();
    const msUntil = ((24 - h) * 3600 - m * 60 - s) * 1000;
    return msUntil > 0 ? msUntil : 24 * 3600 * 1000;
}

async function clearYesterdaySessions() {
    const now = new Date();
    const spainNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
    const yesterday = new Date(spainNow.getTime() - 86400000).toISOString().split('T')[0];

    const { error, count } = await supabase
        .from('day_sessions')
        .delete()
        .lt('date_key', spainNow.toISOString().split('T')[0]);

    if (error) {
        console.error('[MIDNIGHT] Error clearing old sessions:', error.message);
    } else {
        console.log(`[MIDNIGHT] Cleared old day sessions`);
    }
}

export function startMidnightCron() {
    const msUntil = getMsUntilMidnightMadrid();
    console.log(`[MIDNIGHT] Day sessions cleanup scheduled in ${Math.round(msUntil / 60000)} min (00:00 Madrid)`);

    setTimeout(() => {
        clearYesterdaySessions();
        setInterval(clearYesterdaySessions, 24 * 3600 * 1000);
    }, msUntil);
}
