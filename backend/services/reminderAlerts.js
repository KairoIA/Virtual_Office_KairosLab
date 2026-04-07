/**
 * Reminder Alerts — Kaira
 * Checks every minute for reminders with due_time.
 * Sends a Telegram message 30 minutes before the scheduled time.
 * Uses Spain timezone (Europe/Madrid).
 */

import supabase from '../db/supabase.js';
import { getBot, getBotChatId } from './telegram.js';

const CHECK_INTERVAL = 60 * 60 * 1000; // 60 minutes (saves egress — alerts fire ~1h before due_time)

// Kaira-style alert messages (paisa, cariñosa)
const ALERT_TEMPLATES = [
    '¡Ey amor! 💁‍♀️ En media horita tienes: *{text}*. No se te vaya a olvidar papi 😘',
    'Amorcito, te aviso que en 30 minutos tienes: *{text}* ⏰ ¡Pilas!',
    '¡Oye mi rey! 👑 Acuérdate que en media hora: *{text}*. Yo aquí pendiente de ti 💅',
    'Papi lindo, en 30 min tienes: *{text}* 🔔 No me vayas a quedar mal, ¿oíste?',
    'Te cuento amor 💕 En media horita: *{text}*. ¡Vamos que tú puedes!',
    '¡Parcero! 🫶 No se te olvide que en 30 min: *{text}*. Kaira siempre pendiente de ti ✨',
    'Mi vida, solo pa\' recordarte que en media hora tienes: *{text}* 😊 ¡Éxitos!',
];

function pickTemplate(text) {
    const tmpl = ALERT_TEMPLATES[Math.floor(Math.random() * ALERT_TEMPLATES.length)];
    return tmpl.replace('{text}', text);
}

function getSpainNow() {
    const now = new Date();
    const spain = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
    return spain;
}

async function checkAndAlert() {
    const bot = getBot();
    const chatId = getBotChatId();
    if (!bot || !chatId) return;

    const spainNow = getSpainNow();
    const today = spainNow.toISOString().split('T')[0];
    const nowMinutes = spainNow.getHours() * 60 + spainNow.getMinutes();

    // Get only today's reminders with due_time that haven't been alerted — minimal columns
    const { data: reminders, error } = await supabase
        .from('reminders')
        .select('id, text, due_date, due_time')
        .eq('done', false)
        .eq('alert_sent', false)
        .not('due_time', 'is', null)
        .or(`due_date.eq.${today},due_date.is.null`);

    if (error || !reminders?.length) return;

    for (const rem of reminders) {

        // Parse due_time (HH:MM or HH:MM:SS)
        const [h, m] = rem.due_time.split(':').map(Number);
        const reminderMinutes = h * 60 + m;
        const diff = reminderMinutes - nowMinutes;

        // Send alert when we're between 0-65 minutes before (window covers 60-min polling cycle)
        if (diff >= 0 && diff <= 65) {
            const message = pickTemplate(rem.text);
            try {
                await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
                // Mark alert as sent
                await supabase.from('reminders').update({ alert_sent: true }).eq('id', rem.id);
                console.log(`[ALERTS] Sent 30-min alert for: "${rem.text}" (${rem.due_time})`);
            } catch (err) {
                console.error(`[ALERTS] Failed to send alert for "${rem.text}":`, err.message);
            }
        }
    }
}

export function startReminderAlerts() {
    console.log('[ALERTS] Reminder alerts service started (checking every 60min)');
    // Initial check after 10 seconds (let Telegram bot initialize first)
    setTimeout(() => {
        checkAndAlert();
        setInterval(checkAndAlert, CHECK_INTERVAL);
    }, 10000);
}
