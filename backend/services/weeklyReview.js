/**
 * Weekly & Monthly Review + Behavioral Intelligence — Kaira
 * Weekly: every Sunday at 20:00 CET
 * Monthly: last day of each month at 20:00 CET
 * Includes behavioral insights and productivity patterns
 */

import supabase from '../db/supabase.js';
import Anthropic from '@anthropic-ai/sdk';
import { getBot, getBotChatId } from './telegram.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Schedule ────────────────────────────────────────

export function startWeeklyReview() {
    // Calculate delay until next Sunday 20:00 UTC+1
    const now = new Date();
    const targetHour = 19; // 20:00 CET = 19:00 UTC
    const daysUntilSunday = (7 - now.getUTCDay()) % 7 || 7;

    const nextSunday = new Date(now);
    nextSunday.setUTCDate(now.getUTCDate() + daysUntilSunday);
    nextSunday.setUTCHours(targetHour, 0, 0, 0);

    if (nextSunday <= now) nextSunday.setUTCDate(nextSunday.getUTCDate() + 7);

    const delay = nextSunday - now;
    const delayMin = Math.round(delay / 60000);

    setTimeout(() => {
        generateWeeklyReview();
        setInterval(generateWeeklyReview, 7 * 24 * 60 * 60 * 1000);
    }, delay);

    console.log(`[WEEKLY] Review scheduled. Next run in ${delayMin} min (Sunday 20:00 CET)`);
}

// ── Monthly Review Schedule ─────────────────────────

export function startMonthlyReview() {
    scheduleNextMonthlyReview();
}

function scheduleNextMonthlyReview() {
    const now = new Date();
    const targetHour = 19; // 20:00 CET = 19:00 UTC

    // Calculate last day of current month
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    const lastDay = new Date(Date.UTC(year, month + 1, 0)); // day 0 of next month = last day of current
    lastDay.setUTCHours(targetHour, 0, 0, 0);

    let target = lastDay;
    // If already past this month's last day at target hour, schedule for next month
    if (target <= now) {
        const nextMonthLastDay = new Date(Date.UTC(year, month + 2, 0));
        nextMonthLastDay.setUTCHours(targetHour, 0, 0, 0);
        target = nextMonthLastDay;
    }

    const delay = target - now;
    const delayMin = Math.round(delay / 60000);
    const targetDateStr = target.toISOString().split('T')[0];

    setTimeout(async () => {
        await generateMonthlyReview();
        // After running, recalculate for next month
        scheduleNextMonthlyReview();
    }, delay);

    console.log(`[MONTHLY] Review scheduled. Next run in ${delayMin} min (${targetDateStr} 20:00 CET)`);
}

// ── Data Gathering ──────────────────────────────────

async function gatherWeekData() {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];
    const todayStr = now.toISOString().split('T')[0];

    // All queries in parallel
    const [
        completedRes,
        overdueRemindersRes,
        overdueTasksRes,
        tasksCreatedRes,
        projectsRes,
        expensesRes,
        activityRes,
    ] = await Promise.all([
        supabase.from('completed')
            .select('text, type, completed_date')
            .gte('completed_date', weekAgoStr)
            .order('completed_date', { ascending: false }),

        supabase.from('reminders')
            .select('text, due_date, category')
            .eq('done', false)
            .lt('due_date', todayStr),

        supabase.from('tasks')
            .select('text, deadline')
            .eq('done', false)
            .lt('deadline', todayStr),

        supabase.from('tasks')
            .select('id')
            .gte('created_at', weekAgo.toISOString()),

        supabase.from('projects')
            .select('name, domain, status, updated_at')
            .order('updated_at', { ascending: false }),

        supabase.from('expenses')
            .select('amount, category')
            .gte('date', weekAgoStr),

        supabase.from('activity_log')
            .select('activity, category, date_key')
            .gte('date_key', weekAgoStr)
            .order('date_key', { ascending: false }),
    ]);

    const completed = completedRes.data || [];
    const overdueReminders = overdueRemindersRes.data || [];
    const overdueTasks = overdueTasksRes.data || [];
    const tasksCreated = tasksCreatedRes.data || [];
    const projects = projectsRes.data || [];
    const expenses = expensesRes.data || [];
    const activities = activityRes.data || [];

    return {
        completed,
        overdueReminders,
        overdueTasks,
        tasksCreated,
        projects,
        expenses,
        activities,
        period: { from: weekAgoStr, to: todayStr },
    };
}

// ── Behavioral Analysis (for weekly review enrichment) ──

async function gatherBehavioralData() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    const fourWeeksAgo = new Date(now);
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    const fourWeeksAgoStr = fourWeeksAgo.toISOString().split('T')[0];
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];

    const [
        completedLast30Res,
        expensesLast4WeeksRes,
        overdueCountRes,
    ] = await Promise.all([
        supabase.from('completed')
            .select('type, completed_date')
            .gte('completed_date', thirtyDaysAgoStr)
            .order('completed_date', { ascending: false }),

        supabase.from('expenses')
            .select('amount, date')
            .gte('date', fourWeeksAgoStr),

        supabase.from('reminders')
            .select('id')
            .eq('done', false)
            .not('due_date', 'is', null)
            .lt('due_date', now.toISOString().split('T')[0]),
    ]);

    const completedLast30 = completedLast30Res.data || [];
    const expensesLast4Weeks = expensesLast4WeeksRes.data || [];
    const overdueCount = (overdueCountRes.data || []).length;

    // Completed by day of week
    const byDayOfWeek = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
    completedLast30.forEach(item => {
        const d = new Date(item.completed_date);
        byDayOfWeek[d.getDay()]++;
    });

    const mostProductiveDay = Object.entries(byDayOfWeek)
        .sort((a, b) => b[1] - a[1])[0];

    // Completed by category (using type field)
    const byCategory = {};
    completedLast30.forEach(item => {
        const cat = item.type || 'General';
        byCategory[cat] = (byCategory[cat] || 0) + 1;
    });

    const mostActiveCategory = Object.entries(byCategory)
        .sort((a, b) => b[1] - a[1])[0];

    // Average tasks per week (last 30 days ~ 4.3 weeks)
    const avgTasksPerWeek = Math.round(completedLast30.length / 4.3);

    // Expenses trend: this week vs last 4 weeks avg
    const thisWeekExpenses = expensesLast4Weeks
        .filter(e => e.date >= weekAgoStr)
        .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

    const last4WeeksTotal = expensesLast4Weeks
        .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
    const avgWeeklyExpense = last4WeeksTotal / 4;

    return {
        completedByDayOfWeek: Object.entries(byDayOfWeek)
            .map(([day, count]) => `${dayNames[day]}: ${count}`)
            .join(', '),
        mostProductiveDay: `${dayNames[mostProductiveDay[0]]} (${mostProductiveDay[1]} items)`,
        completedByCategory: Object.entries(byCategory)
            .sort((a, b) => b[1] - a[1])
            .map(([cat, count]) => `${cat}: ${count}`)
            .join(', '),
        mostActiveCategory: mostActiveCategory ? `${mostActiveCategory[0]} (${mostActiveCategory[1]} items)` : 'N/A',
        avgTasksPerWeek,
        totalCompleted30d: completedLast30.length,
        expensesTrend: {
            thisWeek: thisWeekExpenses.toFixed(2),
            avgWeekly: avgWeeklyExpense.toFixed(2),
            diff: thisWeekExpenses > avgWeeklyExpense ? 'above average' : 'below average',
        },
        overdueItemsCount: overdueCount,
    };
}

// ── Generate Weekly Review ──────────────────────────

async function generateWeeklyReview() {
    console.log('[WEEKLY] Generating weekly review...');

    try {
        const weekData = await gatherWeekData();
        const behavioralData = await gatherBehavioralData();

        // Build summary object
        const completedList = weekData.completed.map(c =>
            `- ${c.text} [${c.type || 'General'}] (${c.completed_date})`
        ).join('\n') || 'Ninguno';

        const overdueList = [
            ...weekData.overdueReminders.map(r => `- [Reminder] ${r.text} (due: ${r.due_date})`),
            ...weekData.overdueTasks.map(t => `- [Task] ${t.text} (deadline: ${t.deadline})`),
        ].join('\n') || 'Ninguno';

        const tasksCreatedCount = weekData.tasksCreated.length;
        const tasksCompletedCount = weekData.completed.filter(c => c.type === 'task').length;

        const activeProjects = weekData.projects
            .filter(p => p.status === 'active')
            .map(p => `- ${p.name} [${p.domain}]`)
            .join('\n') || 'Ninguno';

        // Expenses by category
        const expensesByCategory = {};
        let expensesTotal = 0;
        weekData.expenses.forEach(e => {
            const cat = e.category || 'General';
            expensesByCategory[cat] = (expensesByCategory[cat] || 0) + parseFloat(e.amount || 0);
            expensesTotal += parseFloat(e.amount || 0);
        });
        const expensesSummary = Object.entries(expensesByCategory)
            .map(([cat, total]) => `${cat}: ${total.toFixed(2)}EUR`)
            .join(', ') || 'Sin gastos';

        const activitiesList = weekData.activities
            .slice(0, 20)
            .map(a => `- ${a.date_key}: ${a.activity} [${a.category}]`)
            .join('\n') || 'Sin actividades registradas';

        const dataSummary = `
PERIODO: ${weekData.period.from} a ${weekData.period.to}

COMPLETADOS (${weekData.completed.length}):
${completedList}

PENDIENTE/VENCIDO:
${overdueList}

TAREAS: ${tasksCreatedCount} creadas, ${tasksCompletedCount} completadas esta semana

PROYECTOS ACTIVOS:
${activeProjects}

GASTOS: ${expensesTotal.toFixed(2)}EUR total
${expensesSummary}

ACTIVIDADES:
${activitiesList}

--- DATOS COMPORTAMENTALES (ultimos 30 dias) ---
Completados por dia de la semana: ${behavioralData.completedByDayOfWeek}
Dia mas productivo: ${behavioralData.mostProductiveDay}
Completados por categoria: ${behavioralData.completedByCategory}
Categoria mas activa: ${behavioralData.mostActiveCategory}
Promedio tareas/semana: ${behavioralData.avgTasksPerWeek}
Total completados 30d: ${behavioralData.totalCompleted30d}
Gastos esta semana: ${behavioralData.expensesTrend.thisWeek}EUR (promedio semanal: ${behavioralData.expensesTrend.avgWeekly}EUR — ${behavioralData.expensesTrend.diff})
Items vencidos sin completar: ${behavioralData.overdueItemsCount}
`.trim();

        // Send to Claude Haiku
        const response = await anthropic.messages.create({
            model: 'claude-3-5-haiku-20241022',
            max_tokens: 1500,
            messages: [{
                role: 'user',
                content: `You are Kaira, writing the weekly review for your boss Javi.
Write in Spanish with your paisa style (Colombian, warm, direct). Be concise but insightful.

Data for this week:
${dataSummary}

Generate exactly these sections:
1. RESUMEN: What was accomplished (be specific, name tasks/projects)
2. PENDIENTE: What didn't get done and possible reasons
3. TENDENCIAS: Any patterns you notice (productivity, categories, spending)
4. SUGERENCIAS: 3-5 suggested focus areas for next week
5. INSIGHT: One behavioral insight based on the behavioral data (e.g. most productive day, category imbalance, deadline habits)

Keep it under 800 words. Use emojis sparingly for section headers only.`,
            }],
        });

        const reviewText = response.content[0].text;
        console.log('[WEEKLY] Review generated successfully');

        // Save as journal entry with WEEKLY prefix
        const todayStr = new Date().toISOString().split('T')[0];
        const journalContent = `<!-- WEEKLY_REVIEW --><h3>Weekly Review</h3><pre>${reviewText}</pre>`;

        const { data: existing } = await supabase
            .from('journal')
            .select('content')
            .eq('date_key', todayStr)
            .single();

        const finalContent = existing?.content
            ? existing.content + '<br><br>' + journalContent
            : journalContent;

        await supabase
            .from('journal')
            .upsert({ date_key: todayStr, content: finalContent, category: 'General' }, { onConflict: 'date_key' });

        console.log('[WEEKLY] Saved to journal');

        // Send via Telegram
        const bot = getBot();
        const chatId = getBotChatId();
        if (bot && chatId) {
            // Telegram has a 4096 char limit, split if needed
            const header = `📋 *WEEKLY REVIEW — ${todayStr}*\n\n`;
            const fullMessage = header + reviewText;

            if (fullMessage.length <= 4096) {
                await bot.sendMessage(chatId, fullMessage, { parse_mode: 'Markdown' });
            } else {
                // Split into chunks
                const chunks = splitMessage(fullMessage, 4096);
                for (const chunk of chunks) {
                    await bot.sendMessage(chatId, chunk, { parse_mode: 'Markdown' });
                }
            }
            console.log('[WEEKLY] Sent to Telegram');
        } else {
            console.log('[WEEKLY] Telegram bot not available, skipping notification');
        }

    } catch (err) {
        console.error('[WEEKLY] Error generating review:', err.message || err);
    }
}

// ── Monthly Data Gathering ──────────────────────────

async function gatherMonthData() {
    const now = new Date();
    const monthAgo = new Date(now);
    monthAgo.setDate(monthAgo.getDate() - 30);
    const monthAgoStr = monthAgo.toISOString().split('T')[0];
    const todayStr = now.toISOString().split('T')[0];

    const [
        completedRes,
        overdueRemindersRes,
        overdueTasksRes,
        tasksCreatedRes,
        projectsRes,
        expensesRes,
        activityRes,
    ] = await Promise.all([
        supabase.from('completed')
            .select('text, type, completed_date')
            .gte('completed_date', monthAgoStr)
            .order('completed_date', { ascending: false }),

        supabase.from('reminders')
            .select('text, due_date')
            .eq('done', false)
            .lt('due_date', todayStr),

        supabase.from('tasks')
            .select('text, deadline')
            .eq('done', false)
            .lt('deadline', todayStr),

        // Tasks created in the last 30 days (removed duplicate query)
        supabase.from('tasks')
            .select('id')
            .gte('created_at', monthAgo.toISOString()),

        supabase.from('projects')
            .select('name, domain, status, updated_at')
            .order('updated_at', { ascending: false }),

        supabase.from('expenses')
            .select('amount, category')
            .gte('date', monthAgoStr),

        supabase.from('activity_log')
            .select('activity, category, date_key')
            .gte('date_key', monthAgoStr)
            .order('date_key', { ascending: false }),
    ]);

    return {
        completed: completedRes.data || [],
        overdueReminders: overdueRemindersRes.data || [],
        overdueTasks: overdueTasksRes.data || [],
        tasksCreated: tasksCreatedRes.data || [],
        projects: projectsRes.data || [],
        expenses: expensesRes.data || [],
        activities: activityRes.data || [],
        period: { from: monthAgoStr, to: todayStr },
    };
}

// ── Generate Monthly Review ─────────────────────────

async function generateMonthlyReview() {
    console.log('[MONTHLY] Generating monthly review...');

    try {
        const monthData = await gatherMonthData();
        const behavioralData = await gatherBehavioralData();

        // Completed list
        const completedList = monthData.completed.map(c =>
            `- ${c.text} [${c.type || 'General'}] (${c.completed_date})`
        ).join('\n') || 'Ninguno';

        // Overdue
        const overdueList = [
            ...monthData.overdueReminders.map(r => `- [Reminder] ${r.text} (due: ${r.due_date})`),
            ...monthData.overdueTasks.map(t => `- [Task] ${t.text} (deadline: ${t.deadline})`),
        ].join('\n') || 'Ninguno';

        // Tasks created vs completed
        const tasksCreatedCount = monthData.tasksCreated.length;
        const tasksCompletedCount = monthData.completed.filter(c => c.type === 'task').length;
        const taskCompletionRate = tasksCreatedCount > 0
            ? Math.round((tasksCompletedCount / tasksCreatedCount) * 100) : 0;

        // Project milestones — projects updated in last 30 days
        const recentProjects = monthData.projects.filter(p => {
            if (!p.updated_at) return false;
            const updated = new Date(p.updated_at);
            const monthAgo = new Date();
            monthAgo.setDate(monthAgo.getDate() - 30);
            return updated >= monthAgo;
        });
        const projectMilestones = recentProjects
            .map(p => `- ${p.name} [${p.domain}] — Status: ${p.status}`)
            .join('\n') || 'Sin cambios en proyectos';

        const activeProjects = monthData.projects
            .filter(p => p.status === 'active')
            .map(p => `- ${p.name} [${p.domain}]`)
            .join('\n') || 'Ninguno';

        // Full expense breakdown by category
        const expensesByCategory = {};
        let expensesTotal = 0;
        monthData.expenses.forEach(e => {
            const cat = e.category || 'General';
            expensesByCategory[cat] = (expensesByCategory[cat] || 0) + parseFloat(e.amount || 0);
            expensesTotal += parseFloat(e.amount || 0);
        });
        const expensesSummary = Object.entries(expensesByCategory)
            .sort((a, b) => b[1] - a[1])
            .map(([cat, total]) => `${cat}: ${total.toFixed(2)}EUR`)
            .join('\n') || 'Sin gastos';

        // Activities summary
        const activitiesList = monthData.activities
            .slice(0, 40)
            .map(a => `- ${a.date_key}: ${a.activity} [${a.category}]`)
            .join('\n') || 'Sin actividades registradas';

        const dataSummary = `
PERIODO: ${monthData.period.from} a ${monthData.period.to} (30 dias)

COMPLETADOS (${monthData.completed.length}):
${completedList}

PENDIENTE/VENCIDO:
${overdueList}

TAREAS: ${tasksCreatedCount} creadas, ${tasksCompletedCount} completadas (${taskCompletionRate}% completion rate)

HITOS DE PROYECTOS (actualizados este mes):
${projectMilestones}

PROYECTOS ACTIVOS:
${activeProjects}

GASTOS TOTALES: ${expensesTotal.toFixed(2)}EUR
DESGLOSE COMPLETO:
${expensesSummary}

ACTIVIDADES (top 40):
${activitiesList}

--- DATOS COMPORTAMENTALES (ultimos 30 dias) ---
Completados por dia de la semana: ${behavioralData.completedByDayOfWeek}
Dia mas productivo: ${behavioralData.mostProductiveDay}
Completados por categoria: ${behavioralData.completedByCategory}
Categoria mas activa: ${behavioralData.mostActiveCategory}
Promedio tareas/semana: ${behavioralData.avgTasksPerWeek}
Total completados 30d: ${behavioralData.totalCompleted30d}
Gastos promedio semanal: ${behavioralData.expensesTrend.avgWeekly}EUR (tendencia: ${behavioralData.expensesTrend.diff})
Items vencidos sin completar: ${behavioralData.overdueItemsCount}
`.trim();

        // Send to Claude
        const response = await anthropic.messages.create({
            model: 'claude-3-5-haiku-20241022',
            max_tokens: 2500,
            messages: [{
                role: 'user',
                content: `You are Kaira, writing the MONTHLY review for your boss Javi.
Write in Spanish with your paisa style (Colombian, warm, direct). This is the monthly review — more strategic and goals-oriented than the weekly.

Data for the last 30 days:
${dataSummary}

Generate exactly these sections:
1. RESUMEN DEL MES: Major accomplishments, key milestones reached
2. PRODUCTIVIDAD: Task completion rate analysis, created vs completed, patterns
3. PROYECTOS: Status of each project, milestones achieved, what progressed and what stalled
4. FINANZAS: Full expense breakdown, trends, month-over-month comparison insights
5. COMPORTAMIENTO: Deep behavioral analysis — most productive days, category balance, deadline habits, work rhythm
6. OBJETIVOS PARA EL PROXIMO MES: 5-7 strategic goals/focus areas based on data
7. REFLEXION: One insightful observation about work habits or growth pattern

Keep it under 1200 words. Use emojis sparingly for section headers only.`,
            }],
        });

        const reviewText = response.content[0].text;
        console.log('[MONTHLY] Review generated successfully');

        // Save as journal entry with MONTHLY prefix
        const todayStr = new Date().toISOString().split('T')[0];
        const journalContent = `<!-- MONTHLY_REVIEW --><h3>Monthly Review</h3><pre>${reviewText}</pre>`;

        const { data: existing } = await supabase
            .from('journal')
            .select('content')
            .eq('date_key', todayStr)
            .single();

        const finalContent = existing?.content
            ? existing.content + '<br><br>' + journalContent
            : journalContent;

        await supabase
            .from('journal')
            .upsert({ date_key: todayStr, content: finalContent, category: 'General' }, { onConflict: 'date_key' });

        console.log('[MONTHLY] Saved to journal');

        // Send via Telegram
        const bot = getBot();
        const chatId = getBotChatId();
        if (bot && chatId) {
            const header = `📈 *MONTHLY REVIEW — ${todayStr}*\n\n`;
            const fullMessage = header + reviewText;

            if (fullMessage.length <= 4096) {
                await bot.sendMessage(chatId, fullMessage, { parse_mode: 'Markdown' });
            } else {
                const chunks = splitMessage(fullMessage, 4096);
                for (const chunk of chunks) {
                    await bot.sendMessage(chatId, chunk, { parse_mode: 'Markdown' });
                }
            }
            console.log('[MONTHLY] Sent to Telegram');
        } else {
            console.log('[MONTHLY] Telegram bot not available, skipping notification');
        }

    } catch (err) {
        console.error('[MONTHLY] Error generating review:', err.message || err);
    }
}

function splitMessage(text, maxLen) {
    const chunks = [];
    let remaining = text;
    while (remaining.length > maxLen) {
        let splitAt = remaining.lastIndexOf('\n', maxLen);
        if (splitAt === -1 || splitAt < maxLen / 2) splitAt = maxLen;
        chunks.push(remaining.slice(0, splitAt));
        remaining = remaining.slice(splitAt);
    }
    if (remaining) chunks.push(remaining);
    return chunks;
}

// ── Behavioral Insights (standalone, callable from other services) ──

export async function generateBehavioralInsights() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    const { data: completed } = await supabase.from('completed')
        .select('type, completed_date')
        .gte('completed_date', thirtyDaysAgoStr)
        .order('completed_date', { ascending: false });

    const items = completed || [];

    if (items.length === 0) {
        return {
            totalCompleted: 0,
            avgTasksPerWeek: 0,
            mostProductiveDay: 'N/A',
            mostActiveCategory: 'N/A',
            message: 'No hay datos suficientes para generar insights.',
        };
    }

    // Most productive day of week
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
    const byDay = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    items.forEach(item => {
        const d = new Date(item.completed_date);
        byDay[d.getDay()]++;
    });
    const topDay = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0];

    // Most active category
    const byCategory = {};
    items.forEach(item => {
        const cat = item.type || 'General';
        byCategory[cat] = (byCategory[cat] || 0) + 1;
    });
    const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];

    // Average tasks per week
    const avgTasksPerWeek = Math.round(items.length / 4.3);

    // Category distribution
    const categoryDistribution = Object.entries(byCategory)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, count]) => ({ category: cat, count, pct: Math.round((count / items.length) * 100) }));

    const insights = {
        totalCompleted: items.length,
        avgTasksPerWeek,
        mostProductiveDay: `${dayNames[topDay[0]]} (${topDay[1]} items en 30d)`,
        mostActiveCategory: `${topCategory[0]} (${topCategory[1]} items, ${Math.round((topCategory[1] / items.length) * 100)}%)`,
        categoryDistribution,
        dayDistribution: Object.entries(byDay)
            .map(([day, count]) => ({ day: dayNames[day], count })),
    };

    // ── Persist insights to kaira_memory ──────────────
    try {
        // Save full insights object
        await supabase.from('kaira_memory').upsert(
            { category: 'learning', key: 'behavioral_insights', value: JSON.stringify(insights) },
            { onConflict: 'category,key' }
        );

        // Save specific individual memories
        await Promise.all([
            supabase.from('kaira_memory').upsert(
                { category: 'learning', key: 'most_productive_day', value: `El jefe es más productivo los ${dayNames[topDay[0]]}` },
                { onConflict: 'category,key' }
            ),
            supabase.from('kaira_memory').upsert(
                { category: 'learning', key: 'most_active_category', value: `La categoría más activa es ${topCategory[0]}` },
                { onConflict: 'category,key' }
            ),
            supabase.from('kaira_memory').upsert(
                { category: 'learning', key: 'avg_tasks_per_week', value: `Completa una media de ${avgTasksPerWeek} tareas por semana` },
                { onConflict: 'category,key' }
            ),
        ]);

        console.log('[BEHAVIORAL] Insights persisted to kaira_memory');
    } catch (err) {
        console.error('[BEHAVIORAL] Error persisting insights:', err.message || err);
    }

    return insights;
}
