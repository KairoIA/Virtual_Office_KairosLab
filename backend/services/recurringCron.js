/**
 * Recurring Reminders Cron
 * Checks recurring_reminders table daily and creates reminders for today.
 * Runs once on startup + every 24h at ~00:05.
 */

import supabase from '../db/supabase.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

async function processRecurringReminders() {
    const now = new Date();
    const today = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const dayOfWeek = now.getDay();   // 0=Sun, 6=Sat
    const dayOfMonth = now.getDate(); // 1-31

    console.log(`[RECURRING] Checking recurring reminders for ${today} (dow=${dayOfWeek}, dom=${dayOfMonth})`);

    // Fetch all active recurring reminders
    const { data: recurrings, error } = await supabase
        .from('recurring_reminders')
        .select('id, text, frequency, day_of_week, day_of_month, last_triggered')
        .eq('active', true);

    if (error) {
        console.error('[RECURRING] Error fetching recurring reminders:', error.message);
        return;
    }

    if (!recurrings?.length) {
        console.log('[RECURRING] No active recurring reminders found.');
        return;
    }

    let created = 0;

    for (const rec of recurrings) {
        // Skip if already triggered today
        if (rec.last_triggered === today) {
            continue;
        }

        // Check if this reminder should trigger today
        let shouldTrigger = false;

        switch (rec.frequency) {
            case 'daily':
                shouldTrigger = true;
                break;
            case 'weekdays':
                shouldTrigger = dayOfWeek >= 1 && dayOfWeek <= 5;
                break;
            case 'weekly':
                shouldTrigger = dayOfWeek === rec.day_of_week;
                break;
            case 'monthly':
                shouldTrigger = dayOfMonth === rec.day_of_month;
                break;
            default:
                console.warn(`[RECURRING] Unknown frequency "${rec.frequency}" for id=${rec.id}`);
                continue;
        }

        if (!shouldTrigger) continue;

        // Get next position for the reminders table
        const { data: maxPos } = await supabase
            .from('reminders')
            .select('position')
            .order('position', { ascending: false })
            .limit(1)
            .single();

        const position = (maxPos?.position || 0) + 1;

        // Create the reminder
        const { error: insertErr } = await supabase
            .from('reminders')
            .insert({
                text: rec.text,
                due_date: today,
                position,
            });

        if (insertErr) {
            console.error(`[RECURRING] Failed to create reminder for "${rec.text}":`, insertErr.message);
            continue;
        }

        // Update last_triggered
        await supabase
            .from('recurring_reminders')
            .update({ last_triggered: today })
            .eq('id', rec.id);

        console.log(`[RECURRING] Created reminder: "${rec.text}" (${rec.frequency})`);
        created++;
    }

    console.log(`[RECURRING] Done. Created ${created} reminder(s) for ${today}.`);
}

export function startRecurringCron() {
    // Run once on startup
    processRecurringReminders().catch(err =>
        console.error('[RECURRING] Startup run failed:', err)
    );

    // Calculate ms until next 00:05
    const now = new Date();
    const next0005 = new Date(now);
    next0005.setHours(0, 5, 0, 0);
    if (next0005 <= now) {
        next0005.setDate(next0005.getDate() + 1);
    }
    const msUntilFirst = next0005 - now;

    // Schedule first run at 00:05, then every 24h
    setTimeout(() => {
        processRecurringReminders().catch(err =>
            console.error('[RECURRING] Cron run failed:', err)
        );
        setInterval(() => {
            processRecurringReminders().catch(err =>
                console.error('[RECURRING] Cron run failed:', err)
            );
        }, MS_PER_DAY);
    }, msUntilFirst);

    console.log(`[RECURRING] Cron scheduled. Next run in ${Math.round(msUntilFirst / 60000)} min (then every 24h)`);
}
