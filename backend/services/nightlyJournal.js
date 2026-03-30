/**
 * Nightly Journal — Auto-generates daily work report at 23:59 Madrid time
 * If user already wrote a journal, appends AI insights (no duplicates).
 * If not, creates full narrative report of the day's office activity.
 * Notifies via Telegram when done.
 */

import supabase from '../db/supabase.js';
import Anthropic from '@anthropic-ai/sdk';
import { getBot, getBotChatId } from './telegram.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export function startNightlyJournal() {
    const msUntil = getMsUntil2359();
    console.log(`[NIGHTLY] Journal cron scheduled in ${Math.round(msUntil / 60000)} min (23:59 Madrid)`);

    setTimeout(() => {
        generateNightlyJournal();
        setInterval(generateNightlyJournal, 24 * 3600 * 1000);
    }, msUntil);
}

function getMsUntil2359() {
    const now = new Date();
    const spainNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
    const h = spainNow.getHours();
    const m = spainNow.getMinutes();
    const s = spainNow.getSeconds();

    // Target: 23:59
    const targetMinutes = 23 * 60 + 59;
    const currentMinutes = h * 60 + m;
    let diffMinutes = targetMinutes - currentMinutes;
    if (diffMinutes <= 0) diffMinutes += 24 * 60; // next day

    return (diffMinutes * 60 - s) * 1000;
}

async function generateNightlyJournal() {
    try {
        const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' })).toISOString().split('T')[0];
        console.log(`[NIGHTLY] Generating journal for ${today}...`);

        // Check if user already wrote a journal today
        const { data: existingJournal } = await supabase
            .from('journal').select('content')
            .eq('date_key', today).single();

        const userJournal = existingJournal?.content || '';

        // Gather all day activity
        const activity = await gatherDayActivity(today);

        // If there's nothing to report, skip
        if (!activity.hasActivity) {
            console.log('[NIGHTLY] No activity detected, skipping journal.');
            return;
        }

        // Generate AI report
        const report = await generateReport(activity, userJournal, today);
        if (!report) return;

        // Write to journal
        if (userJournal) {
            // Append to existing — user wrote first, AI adds insights
            await supabase.from('journal').update({
                content: userJournal + '<br><br><hr><br><b>📊 Reporte automático Kaira:</b><br>' + report
            }).eq('date_key', today);
        } else {
            // Create new journal entry
            await supabase.from('journal').upsert({
                date_key: today,
                content: '<b>📊 Reporte del día — Kaira:</b><br><br>' + report
            }, { onConflict: 'date_key' });
        }

        // Notify via Telegram
        const bot = getBot();
        const chatId = getBotChatId();
        if (bot && chatId) {
            const emoji = userJournal ? '✏️' : '📝';
            const action = userJournal ? 'He complementado tu journal de hoy con el reporte del día' : 'He escrito el journal de hoy con el reporte del día';
            await bot.sendMessage(chatId, `${emoji} *${action}*\n\n_Revísalo cuando quieras, amor_ 💋`, {
                parse_mode: 'Markdown'
            });
        }

        console.log(`[NIGHTLY] Journal ${userJournal ? 'appended' : 'created'} for ${today}`);
    } catch (err) {
        console.error('[NIGHTLY] Error generating journal:', err.message);
    }
}

async function gatherDayActivity(today) {
    const [
        completedRes, sessionsRes, projectsRes, tasksRes,
        remindersRes, inboxRes, journalRes, notesRes,
        expensesRes, contentRes, activityRes, projNotesRes
    ] = await Promise.all([
        supabase.from('completed').select('*').eq('completed_date', today).order('created_at'),
        supabase.from('day_sessions').select('*, projects(name)').eq('date_key', today).order('slot').order('position'),
        supabase.from('projects').select('*').neq('status', 'done').order('position'),
        supabase.from('tasks').select('*, projects:project_id(name)').order('position'),
        supabase.from('reminders').select('*').order('position'),
        supabase.from('inbox').select('*').eq('processed', true).gte('created_at', today + 'T00:00:00').order('created_at'),
        supabase.from('journal').select('*').eq('date_key', today).single(),
        supabase.from('project_notes').select('*, projects:project_id(name)').gte('created_at', today + 'T00:00:00').order('created_at'),
        supabase.from('expenses').select('*').eq('date', today),
        supabase.from('saved_content').select('*').gte('created_at', today + 'T00:00:00'),
        supabase.from('activity_log').select('*').eq('date', today).order('created_at'),
        supabase.from('project_notes').select('*, projects:project_id(name)').gte('created_at', today + 'T00:00:00'),
    ]);

    const completed = completedRes.data || [];
    const sessions = sessionsRes.data || [];
    const tasks = tasksRes.data || [];
    const reminders = remindersRes.data || [];
    const inbox = inboxRes.data || [];
    const notes = notesRes.data || [];
    const expenses = expensesRes.data || [];
    const content = contentRes.data || [];
    const activity = activityRes.data || [];
    const projNotes = projNotesRes.data || [];

    const hasActivity = completed.length > 0 || sessions.length > 0 ||
        inbox.length > 0 || notes.length > 0 || activity.length > 0 ||
        expenses.length > 0 || content.length > 0 || projNotes.length > 0;

    return {
        hasActivity,
        completed,
        sessions,
        tasks: tasks.filter(t => !t.done),
        reminders: reminders.filter(r => !r.done),
        inbox,
        notes,
        expenses,
        content,
        activity,
        projNotes,
        projects: projectsRes.data || [],
    };
}

async function generateReport(data, userJournal, today) {
    try {
        // Build context
        const sessionsDone = data.sessions.filter(s => s.done);
        const sessionsNotDone = data.sessions.filter(s => !s.done);

        let context = `Date: ${today}\n\n`;

        if (data.sessions.length > 0) {
            context += `DAY PLAN:\n`;
            context += `  Completed: ${sessionsDone.map(s => `[${s.slot}] ${s.domain} — ${s.focus_text || 'sin detalle'}`).join('; ') || 'none'}\n`;
            context += `  Not completed: ${sessionsNotDone.map(s => `[${s.slot}] ${s.domain} — ${s.focus_text || 'sin detalle'}`).join('; ') || 'none'}\n\n`;
        }

        if (data.completed.length > 0) {
            context += `COMPLETED TODAY (${data.completed.length}):\n`;
            data.completed.forEach(c => { context += `  - [${c.type}] ${c.text}\n`; });
            context += '\n';
        }

        if (data.projNotes.length > 0) {
            context += `PROJECT NOTES ADDED:\n`;
            data.projNotes.forEach(n => { context += `  - [${n.projects?.name || 'Unknown'}] ${n.content}\n`; });
            context += '\n';
        }

        if (data.inbox.length > 0) {
            context += `INBOX PROCESSED (${data.inbox.length}):\n`;
            data.inbox.slice(0, 10).forEach(i => { context += `  - ${i.text}\n`; });
            context += '\n';
        }

        if (data.activity.length > 0) {
            context += `ACTIVITY LOG:\n`;
            data.activity.forEach(a => { context += `  - [${a.category}] ${a.description}\n`; });
            context += '\n';
        }

        if (data.expenses.length > 0) {
            context += `EXPENSES:\n`;
            data.expenses.forEach(e => { context += `  - ${e.concept}: ${e.amount}€ [${e.category}]\n`; });
            context += '\n';
        }

        if (data.content.length > 0) {
            context += `CONTENT SAVED: ${data.content.length} items\n\n`;
        }

        context += `PENDING: ${data.tasks.length} tasks, ${data.reminders.length} reminders\n`;

        if (userJournal) {
            context += `\nUSER'S OWN JOURNAL ENTRY (already written — DO NOT repeat this info, only ADD new insights):\n${userJournal.replace(/<[^>]*>/g, ' ').substring(0, 500)}\n`;
        }

        const response = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 800,
            messages: [{
                role: 'user',
                content: `Eres Kaira, secretaria de Javi en KairosLab. Escribe un reporte narrativo BREVE del día de trabajo basándote en esta actividad de la oficina.

ACTIVIDAD:
${context}

REGLAS:
- Escribe en español, tono profesional pero cercano (eres paisa colombiana).
- Narrativo, no lista — como un resumen de fin de día. 2-4 párrafos cortos.
- Si el usuario ya escribió journal, SOLO añade lo que él NO mencionó. No repitas.
- Menciona qué se completó, en qué proyectos se trabajó, qué quedó pendiente.
- Si hay day plan items no completados, menciónalo brevemente.
- Si no hubo mucha actividad, sé breve. No inventes cosas que no pasaron.
- NO uses markdown ni headers. Solo texto plano con <br> para saltos de línea.
- Usa emojis con moderación (1-2 máximo).`
            }],
        });

        return response.content[0]?.text || null;
    } catch (err) {
        console.error('[NIGHTLY] AI generation error:', err.message);
        return null;
    }
}
