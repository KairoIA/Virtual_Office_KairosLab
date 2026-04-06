/**
 * Morning Briefing — Daily summary at 08:00 Spain time (UTC+1/+2)
 * Sends Telegram digest with deadlines, overdue, unfinished tasks, projects status
 */

import supabase from '../db/supabase.js';
import { getBot, getBotChatId } from './telegram.js';
import { executeFunction } from './functionExecutor.js';

let briefingInterval = null;
let briefingSentToday = null; // track date of last sent briefing

export function startMorningBriefing() {
    const now = new Date();
    const spainHour = getSpainHour(now);

    // Schedule next 08:00 Spain time
    const msUntilNext8 = getMsUntilNext8AM();
    console.log(`[BRIEFING] Next morning briefing in ${Math.round(msUntilNext8 / 60000)} minutes`);

    setTimeout(() => {
        sendMorningBriefing();
        // Then every 24h
        briefingInterval = setInterval(sendMorningBriefing, 24 * 60 * 60 * 1000);
    }, msUntilNext8);

    // On restart after 8 AM: send briefing only if not already sent today
    const todayStr = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Madrid' })).toISOString().split('T')[0];
    if (spainHour >= 8 && spainHour < 22 && briefingSentToday !== todayStr) {
        console.log('[BRIEFING] Running startup briefing (Spain hour:', spainHour, ')');
        setTimeout(() => sendMorningBriefing(), 8000); // 8s delay to let bot + chatId initialize
    }

    // Register callback query handler after a short delay
    setTimeout(() => registerCallbackHandlers(), 3000);
}

function getSpainHour(date) {
    // Spain is UTC+1 (CET) or UTC+2 (CEST)
    // Simple approach: use Intl to get actual Spain time
    const spainTime = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
    return spainTime.getHours();
}

function getMsUntilNext8AM() {
    const now = new Date();
    // Get current time in Spain
    const spainNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
    const spainHour = spainNow.getHours();
    const spainMinute = spainNow.getMinutes();

    let hoursUntil8;
    if (spainHour < 8) {
        hoursUntil8 = 8 - spainHour;
    } else {
        hoursUntil8 = 24 - spainHour + 8; // next day
    }

    const msUntil = (hoursUntil8 * 60 - spainMinute) * 60 * 1000;
    return msUntil > 0 ? msUntil : 24 * 60 * 60 * 1000; // fallback to 24h
}

export async function sendMorningBriefing() {
    const bot = getBot();
    const chatId = getBotChatId();

    if (!bot || !chatId) {
        console.log('[BRIEFING] Bot or chat ID not available yet, retrying in 60s...');
        setTimeout(() => sendMorningBriefing(), 60000);
        return;
    }

    try {
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        // End of week (Sunday)
        const todayDate = new Date(today);
        const daysUntilSunday = 7 - todayDate.getDay();
        const endOfWeek = new Date(todayDate.getTime() + daysUntilSunday * 86400000).toISOString().split('T')[0];

        const [remindersRes, tasksRes, yesterdayPlanRes, projectsRes, inboxRes, contentRes, notesRes, recurringRes] = await Promise.all([
            supabase.from('reminders').select('id, text, due_date, category, priority').eq('done', false).order('position'),
            supabase.from('tasks').select('id, text, deadline, category, priority, project_id').eq('done', false).order('position'),
            supabase.from('daily_plan').select('text').eq('date_key', yesterday).eq('done', false),
            supabase.from('projects').select('id, name, domain, status, project_type').neq('status', 'done').order('position'),
            supabase.from('inbox').select('text').eq('processed', false).order('created_at', { ascending: false }),
            supabase.from('saved_content').select('topic').eq('reviewed', false),
            supabase.from('notes').select('text, category, pinned').eq('pinned', true).limit(10),
            supabase.from('recurring_reminders').select('text, frequency').eq('active', true),
        ]);

        const allReminders = remindersRes.data || [];
        const allTasks = tasksRes.data || [];
        const todayDeadlines = allReminders.filter(r => r.due_date === today);
        const overdue = allReminders.filter(r => r.due_date && r.due_date < today);
        const thisWeek = allReminders.filter(r => {
            if (!r.due_date) return false;
            return r.due_date > today && r.due_date <= endOfWeek;
        }).sort((a, b) => a.due_date.localeCompare(b.due_date));
        const noDate = allReminders.filter(r => !r.due_date);
        const unfinishedYesterday = yesterdayPlanRes.data || [];
        const activeProjects = (projectsRes.data || []).filter(p => p.status === 'active');
        const blockedProjects = (projectsRes.data || []).filter(p => p.status === 'blocked');
        const inbox = inboxRes.data || [];
        const pendingContent = contentRes.data || [];
        const notes = (notesRes.data || []).filter(n => n.pinned);
        const recurring = recurringRes.data || [];

        // ── Build message ──
        const dayNames = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
        const dayName = dayNames[todayDate.getDay()];
        let msg = `🌅 *Buenos dias amor! Tu briefing del ${dayName}:*\n`;
        msg += `📅 ${today}\n\n`;

        // ── OVERDUE (highest priority)
        if (overdue.length > 0) {
            msg += `🔴 *OVERDUE (${overdue.length}):*\n`;
            overdue.forEach(r => {
                msg += `  • ${r.text} (${r.due_date}) [${r.category || 'General'}]\n`;
            });
            msg += '\n';
        }

        // ── TODAY
        if (todayDeadlines.length > 0) {
            msg += `📌 *HOY (${todayDeadlines.length}):*\n`;
            todayDeadlines.forEach(r => {
                const prio = r.priority === 'red' ? '🔴' : r.priority === 'yellow' ? '🟡' : '📌';
                msg += `  ${prio} ${r.text} [${r.category || 'General'}]\n`;
            });
            msg += '\n';
        }

        // ── REST OF THE WEEK
        if (thisWeek.length > 0) {
            msg += `📆 *ESTA SEMANA (${thisWeek.length}):*\n`;
            thisWeek.forEach(r => {
                const d = new Date(r.due_date);
                const dn = dayNames[d.getDay()];
                msg += `  • ${dn} ${r.due_date.slice(5)}: ${r.text} [${r.category || 'General'}]\n`;
            });
            msg += '\n';
        }

        // ── UNFINISHED YESTERDAY
        if (unfinishedYesterday.length > 0) {
            msg += `⏳ *Sin terminar ayer (${unfinishedYesterday.length}):*\n`;
            unfinishedYesterday.forEach(p => {
                msg += `  • ${p.text}\n`;
            });
            msg += '\n';
        }

        // ── TASKS — split by project vs standalone
        const projectTasks = allTasks.filter(t => t.project_id);
        const standaloneTasks = allTasks.filter(t => !t.project_id);
        const taskDeadlineSoon = allTasks.filter(t => t.deadline && t.deadline >= today && t.deadline <= endOfWeek);

        if (standaloneTasks.length > 0) {
            msg += `✅ *Tasks sueltas:* ${standaloneTasks.length}\n`;
            standaloneTasks.slice(0, 8).forEach(t => {
                const dl = t.deadline ? ` [${t.deadline}]` : '';
                const cat = t.category ? ` (${t.category})` : '';
                msg += `  • ${t.text}${dl}${cat}\n`;
            });
            if (standaloneTasks.length > 8) msg += `  ... y ${standaloneTasks.length - 8} mas\n`;
            msg += '\n';
        }

        // ── REMINDERS WITHOUT DATE
        if (noDate.length > 0) {
            msg += `🔔 *Reminders sin fecha:* ${noDate.length}\n`;
            noDate.slice(0, 5).forEach(r => {
                msg += `  • ${r.text} [${r.category || 'General'}]\n`;
            });
            if (noDate.length > 5) msg += `  ... y ${noDate.length - 5} mas\n`;
            msg += '\n';
        }

        // ── PROJECTS — with their tasks
        msg += `🗂️ *Proyectos activos:* ${activeProjects.length}`;
        if (blockedProjects.length > 0) msg += ` (⚠️ ${blockedProjects.length} bloqueados)`;
        msg += '\n';
        activeProjects.forEach(p => {
            const pType = (p.project_type || 'temporal') === 'permanent' ? '♾' : '🎯';
            const pTasks = projectTasks.filter(t => t.project_id === p.id);
            const pendingCount = pTasks.length;
            msg += `  ${pType} [${p.domain}] *${p.name}*`;
            if (pendingCount > 0) msg += ` — ${pendingCount} task${pendingCount > 1 ? 's' : ''}`;
            msg += '\n';
            pTasks.slice(0, 3).forEach(t => {
                const dl = t.deadline ? ` [${t.deadline}]` : '';
                msg += `      • ${t.text}${dl}\n`;
            });
            if (pendingCount > 3) msg += `      ... y ${pendingCount - 3} mas\n`;
        });
        msg += '\n';

        // ── INBOX
        if (inbox.length > 0) {
            msg += `📥 *Inbox sin procesar (${inbox.length}):*\n`;
            inbox.slice(0, 5).forEach(i => {
                msg += `  • ${i.text}\n`;
            });
            if (inbox.length > 5) msg += `  ... y ${inbox.length - 5} mas\n`;
            msg += '\n';
        }

        // ── WATCH LATER
        if (pendingContent.length > 0) {
            msg += `🎬 *Watch Later pendiente:* ${pendingContent.length}`;
            const byTopic = {};
            pendingContent.forEach(c => {
                const t = c.topic || 'General';
                byTopic[t] = (byTopic[t] || 0) + 1;
            });
            msg += ` (${Object.entries(byTopic).map(([t, n]) => `${t}: ${n}`).join(', ')})\n`;
            msg += '\n';
        }

        // ── PINNED NOTES
        if (notes.length > 0) {
            msg += `📌 *Notas fijadas:*\n`;
            notes.forEach(n => {
                msg += `  • ${n.text} [${n.category || 'General'}]\n`;
            });
            msg += '\n';
        }

        // ── OFFICE SCAN SUMMARY
        const totalItems = allReminders.length + allTasks.length;
        msg += `📊 *Scan oficina:* ${totalItems} items (${allReminders.length} reminders, ${allTasks.length} tasks), ${activeProjects.length} proyectos, ${inbox.length} inbox, ${pendingContent.length} watch later\n\n`;

        // ── PRIORITY RECOMMENDATION — ordered by urgency
        msg += `🚨 *Lo mas urgente:*\n`;
        const urgentList = [];

        // 1. Overdue = max urgency
        overdue.forEach(r => urgentList.push({ text: r.text, reason: `overdue ${r.due_date}`, urgency: 0 }));

        // 2. Today deadlines
        todayDeadlines.forEach(r => urgentList.push({ text: r.text, reason: 'hoy', urgency: 1 }));

        // 3. Tasks with deadline this week
        taskDeadlineSoon.forEach(t => {
            const proj = activeProjects.find(p => p.id === t.project_id);
            const label = proj ? `[${proj.name}] ${t.text}` : t.text;
            urgentList.push({ text: label, reason: `deadline ${t.deadline}`, urgency: 2 });
        });

        // 4. Blocked projects
        blockedProjects.forEach(p => urgentList.push({ text: `Desbloquear "${p.name}"`, reason: 'bloqueado', urgency: 3 }));

        // 5. Inbox
        if (inbox.length > 3) urgentList.push({ text: `Procesar inbox (${inbox.length})`, reason: 'acumulado', urgency: 4 });

        if (urgentList.length > 0) {
            urgentList.sort((a, b) => a.urgency - b.urgency);
            urgentList.slice(0, 5).forEach((item, i) => {
                msg += `  ${i + 1}. ${item.text} — ${item.reason}\n`;
            });
        } else {
            msg += `  Todo limpio — buen dia para avanzar proyectos.`;
            if (activeProjects.length > 0) {
                msg += ` Sugerencia: "${activeProjects[0].name}"`;
            }
            msg += '\n';
        }
        msg += '\n';

        const keyboard = {
            inline_keyboard: [
                [
                    { text: '📋 Build my plan', callback_data: 'build_plan' },
                    { text: '📊 Full details', callback_data: 'full_details' },
                ]
            ]
        };

        await bot.sendMessage(chatId, msg, {
            parse_mode: 'Markdown',
            reply_markup: keyboard,
        });

        briefingSentToday = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' })).toISOString().split('T')[0];
        console.log('[BRIEFING] Morning briefing sent');
    } catch (err) {
        console.error('[BRIEFING] Error sending morning briefing:', err.message);
    }
}

function registerCallbackHandlers() {
    const bot = getBot();
    if (!bot) {
        console.log('[BRIEFING] Bot not ready for callback handlers');
        return;
    }

    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;

        try {
            if (data === 'build_plan') {
                await bot.answerCallbackQuery(query.id, { text: 'Construyendo tu day plan...' });

                // Step 1: Build analysis
                const analysis = await executeFunction('build_day_sessions', { date: new Date().toISOString().split('T')[0] });

                // Step 2: Let Kaira AI create the 4 sessions based on analysis
                const { processAIForDayPlan } = await import('./ai.js');
                const sessions = await processAIForDayPlan(analysis);

                // Step 3: Set each session
                const slotLabels = {
                    morning: '🌅 Morning (08:00–11:30)',
                    afternoon: '☀️ Afternoon (11:30–14:30)',
                    evening: '🌆 Evening (17:00–19:30)',
                    night: '🌙 Early Night (19:30–23:00)',
                };

                let msg = `📋 *DAY PLAN — ${new Date().toISOString().split('T')[0]}*\n\n`;

                if (sessions && sessions.length) {
                    // Clear existing sessions before building new ones
                    const today = new Date().toISOString().split('T')[0];
                    for (const slot of ['morning', 'afternoon', 'evening', 'night']) {
                        await executeFunction('clear_day_session', { slot, date: today });
                    }

                    for (const s of sessions) {
                        await executeFunction('set_day_session', s);
                        msg += `${slotLabels[s.slot] || s.slot}\n`;
                        msg += `➤ *${s.domain}*${s.focus_text ? ' — ' + s.focus_text : ''}\n\n`;
                    }
                    msg += `_Dile a Kaira si quieres cambiar algo_ 💁‍♀️`;
                } else {
                    // Fallback: show raw analysis
                    if (analysis.office_state?.overdue?.length) msg += `*Overdue:*\n${analysis.office_state.overdue.join('\n')}\n\n`;
                    if (analysis.office_state?.urgent?.length) msg += `*Urgente:*\n${analysis.office_state.urgent.join('\n')}\n\n`;
                    msg += `_No pude armar el plan automático. Dile a Kaira qué quieres hacer hoy._`;
                }

                await bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });

            } else if (data === 'full_details') {
                await bot.answerCallbackQuery(query.id, { text: 'Cargando detalles...' });

                const today = new Date().toISOString().split('T')[0];
                const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

                const [remindersRes, yesterdayPlanRes, projectsRes, inboxRes] = await Promise.all([
                    supabase.from('reminders').select('text, due_date, priority, category').eq('done', false).order('due_date'),
                    supabase.from('daily_plan').select('text').eq('date_key', yesterday).eq('done', false),
                    supabase.from('projects').select('name, domain').eq('status', 'active'),
                    supabase.from('inbox').select('text').eq('processed', false).order('created_at', { ascending: false }).limit(10),
                ]);

                const reminders = remindersRes.data || [];
                const unfinished = yesterdayPlanRes.data || [];
                const projects = projectsRes.data || [];
                const inbox = inboxRes.data || [];

                let msg = `📊 *Detalle completo:*\n\n`;

                // All reminders grouped by priority
                const red = reminders.filter(r => r.priority === 'red');
                const yellow = reminders.filter(r => r.priority === 'yellow');
                const green = reminders.filter(r => r.priority === 'green' || !r.priority);

                if (red.length > 0) {
                    msg += `🔴 *Prioridad alta (${red.length}):*\n`;
                    red.forEach(r => msg += `  • ${r.text}${r.due_date ? ` [${r.due_date}]` : ''}\n`);
                    msg += '\n';
                }
                if (yellow.length > 0) {
                    msg += `🟡 *Prioridad media (${yellow.length}):*\n`;
                    yellow.forEach(r => msg += `  • ${r.text}${r.due_date ? ` [${r.due_date}]` : ''}\n`);
                    msg += '\n';
                }
                if (green.length > 0) {
                    msg += `🟢 *Normal (${green.length}):*\n`;
                    green.slice(0, 10).forEach(r => msg += `  • ${r.text}${r.due_date ? ` [${r.due_date}]` : ''}\n`);
                    if (green.length > 10) msg += `  ... y ${green.length - 10} mas\n`;
                    msg += '\n';
                }

                if (unfinished.length > 0) {
                    msg += `⏳ *Sin terminar ayer:*\n`;
                    unfinished.forEach(p => msg += `  • ${p.text}\n`);
                    msg += '\n';
                }

                if (projects.length > 0) {
                    msg += `🗂️ *Proyectos activos (${projects.length}):*\n`;
                    projects.forEach(p => {
                        msg += `  • [${p.domain}] ${p.name}`;
                        // project name only
                        msg += '\n';
                    });
                    msg += '\n';
                }

                if (inbox.length > 0) {
                    msg += `📥 *Inbox (${inbox.length}):*\n`;
                    inbox.forEach(i => msg += `  • ${i.text}\n`);
                    msg += '\n';
                }

                await bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
            }
        } catch (err) {
            console.error('[BRIEFING] Callback error:', err.message);
            await bot.sendMessage(chatId, `⚠️ Error: ${err.message}`);
        }
    });

    console.log('[BRIEFING] Callback handlers registered');
}
