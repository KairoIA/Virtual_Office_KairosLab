/**
 * Function Executor — V2
 * Executes AI function calls against Supabase
 */

import supabase from '../db/supabase.js';
import { webSearch } from './websearch.js';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function executeFunction(name, args) {
    switch (name) {
        case 'add_reminder':       return addReminder(args);
        case 'add_task':           return addTask(args);
        case 'complete_item':      return completeItem(args);
        case 'delete_item':        return deleteItem(args);
        case 'write_journal':      return writeJournal(args);
        case 'read_journal':       return readJournal(args);
        case 'get_agenda':         return getAgenda(args);
        case 'search_entries':     return searchEntries(args);
        case 'create_project':     return createProject(args);
        case 'update_project':     return updateProject(args);
        case 'add_to_inbox':       return addToInbox(args);
        case 'set_daily_plan':     return setDailyPlan(args);
        case 'build_daily_plan':   return buildDailyPlan(args);
        case 'move_plan_item':     return movePlanItem(args);
        case 'get_project_docs':   return getProjectDocs(args);
        case 'add_note':           return addNote(args);
        case 'get_notes':          return getNotes(args);
        case 'delete_note':        return deleteNote(args);
        case 'get_briefing':       return getBriefing(args);
        case 'log_expense':        return logExpense(args);
        case 'get_expenses':       return getExpenses(args);
        case 'save_memory':        return saveMemory(args);
        case 'recall_memory':      return recallMemory(args);
        case 'manage_list':        return manageList(args);
        case 'log_activity':       return logActivity(args);
        case 'get_activity_summary': return getActivitySummary(args);
        case 'save_content':       return saveContent(args);
        case 'get_saved_content':  return getSavedContent(args);
        case 'mark_content_reviewed': return markContentReviewed(args);
        case 'create_recurring':   return createRecurring(args);
        case 'list_recurring':     return listRecurring(args);
        case 'web_search':         return webSearch(args.query);
        case 'summarize_url':      return summarizeUrl(args);
        case 'process_inbox':    return processInbox(args);
        case 'get_completed':    return getCompleted(args);
        case 'edit_task':        return editTask(args);
        case 'edit_reminder':    return editReminder(args);
        case 'delete_plan_item': return deletePlanItem(args);
        case 'get_day_history':  return getDayHistory(args);
        case 'set_day_session':  return setDaySession(args);
        case 'edit_day_session': return editDaySession(args);
        case 'delete_day_session_item': return deleteDaySessionItem(args);
        case 'clear_day_session': return clearDaySession(args);
        case 'build_day_sessions': return buildDaySessions(args);
        case 'get_day_sessions': return getDaySessions(args);
        case 'add_project_note': return addProjectNote(args);
        case 'get_project_notes': return getProjectNotes(args);
        default:
            return { error: `Unknown function: ${name}` };
    }
}

// ── V1 Functions (kept) ─────────────────────────────────

async function addReminder({ text, due_date, due_time, project_id, category, priority }) {
    const { data: maxPos } = await supabase
        .from('reminders').select('position')
        .order('position', { ascending: false }).limit(1).single();

    const row = { text, due_date: due_date || null, position: (maxPos?.position || 0) + 1 };
    if (due_time) row.due_time = due_time;
    if (project_id) row.project_id = project_id;
    if (category) row.category = category;
    if (priority) row.priority = priority;

    const { data, error } = await supabase
        .from('reminders').insert(row).select().single();

    if (error) return { error: error.message };
    const prioLabel = priority ? ` [${priority}]` : '';
    const timeLabel = due_time ? ` at ${due_time}` : '';
    return { success: true, message: `Reminder added: "${text}"${due_date ? ` for ${due_date}` : ''}${timeLabel}${prioLabel}` };
}

async function addTask({ text, deadline, project_id, category, priority }) {
    const { data: maxPos } = await supabase
        .from('tasks').select('position')
        .order('position', { ascending: false }).limit(1).single();

    const row = { text, position: (maxPos?.position || 0) + 1 };
    if (deadline) row.deadline = deadline;
    if (project_id) row.project_id = project_id;
    if (category) row.category = category;
    if (priority) row.priority = priority;

    const { data, error } = await supabase
        .from('tasks').insert(row).select().single();

    if (error) return { error: error.message };
    return { success: true, message: `Task added: "${text}"${deadline ? ` [deadline: ${deadline}]` : ''}` };
}

async function completeItem({ item_type, search_text }) {
    const table = item_type === 'reminder' ? 'reminders' : 'tasks';
    const { data: items } = await supabase
        .from(table).select('*')
        .ilike('text', `%${search_text}%`)
        .eq('done', false)
        .limit(1);

    if (!items?.length) return { error: `No matching ${item_type} found for "${search_text}"` };

    const item = items[0];
    await supabase.from(table).delete().eq('id', item.id);

    let duration = '';
    if (item_type === 'task' && item.created_at) {
        const days = Math.floor((Date.now() - new Date(item.created_at).getTime()) / 86400000);
        duration = `${days} days`;
    }

    await supabase.from('completed').insert({
        text: item.text,
        type: item_type === 'reminder' ? 'Reminder' : 'Task',
        duration,
    });

    return { success: true, message: `Completed: "${item.text}"` };
}

async function deleteItem({ item_type, search_text }) {
    const table = item_type === 'reminder' ? 'reminders' : 'tasks';
    const { data: items } = await supabase
        .from(table).select('id, text')
        .ilike('text', `%${search_text}%`)
        .limit(1);

    if (!items?.length) return { error: `No matching ${item_type} found for "${search_text}"` };

    await supabase.from(table).delete().eq('id', items[0].id);
    return { success: true, message: `Deleted: "${items[0].text}"` };
}

async function writeJournal({ date, content, append, category, project_id }) {
    const { data: existing } = await supabase
        .from('journal').select('content')
        .eq('date_key', date).single();

    const finalContent = append && existing?.content
        ? existing.content + '<br>' + content
        : content;

    const row = { date_key: date, content: finalContent };
    if (category) row.category = category;
    if (project_id) row.project_id = project_id;

    const { error } = await supabase
        .from('journal')
        .upsert(row, { onConflict: 'date_key' });

    if (error) return { error: error.message };
    return { success: true, message: `Journal ${append ? 'updated' : 'written'} for ${date}${category ? ` [${category}]` : ''}` };
}

async function readJournal({ date, date_from, date_to }) {
    if (date) {
        const { data } = await supabase.from('journal')
            .select('date_key, content, category')
            .eq('date_key', date)
            .single();
        if (!data) return { message: `No journal entry for ${date}` };
        // Strip HTML tags for cleaner AI reading
        const cleanContent = data.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        return { entries: [{ date: data.date_key, content: cleanContent, category: data.category }] };
    }

    // Date range (defaults to last 7 days)
    const from = date_from || new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const to = date_to || new Date().toISOString().split('T')[0];

    const { data } = await supabase.from('journal')
        .select('date_key, content, category')
        .gte('date_key', from)
        .lte('date_key', to)
        .order('date_key', { ascending: false })
        .limit(30);

    if (!data?.length) return { message: `No journal entries between ${from} and ${to}` };
    return {
        period: `${from} → ${to}`,
        count: data.length,
        entries: data.map(j => ({
            date: j.date_key,
            content: j.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
            category: j.category,
        })),
    };
}

async function getDayHistory({ date, date_from, date_to }) {
    const from = date || date_from || new Date().toISOString().split('T')[0];
    const to = date || date_to || from;

    const [journalRes, completedRes, planRes, activityRes, expensesRes, inboxRes, contentRes, remindersRes, tasksRes, notesRes] = await Promise.all([
        supabase.from('journal').select('date_key, content, category').gte('date_key', from).lte('date_key', to).order('date_key'),
        supabase.from('completed').select('text, type, completed_date, duration').gte('completed_date', from).lte('completed_date', to).order('completed_date'),
        supabase.from('daily_plan').select('slot, text, category, done, date_key').gte('date_key', from).lte('date_key', to).order('date_key'),
        supabase.from('activity_log').select('activity, category, date_key, notes').gte('date_key', from).lte('date_key', to).order('date_key'),
        supabase.from('expenses').select('concept, amount, category, date_key').gte('date_key', from).lte('date_key', to).order('date_key'),
        supabase.from('inbox').select('text, created_at, processed').gte('created_at', from + 'T00:00:00').lte('created_at', to + 'T23:59:59').order('created_at'),
        supabase.from('saved_content').select('title, topic, source, reviewed, created_at').gte('created_at', from + 'T00:00:00').lte('created_at', to + 'T23:59:59').order('created_at'),
        supabase.from('reminders').select('text, due_date, category, done, created_at').gte('created_at', from + 'T00:00:00').lte('created_at', to + 'T23:59:59'),
        supabase.from('tasks').select('text, deadline, category, done, created_at').gte('created_at', from + 'T00:00:00').lte('created_at', to + 'T23:59:59'),
        supabase.from('notes').select('text, category, created_at').gte('created_at', from + 'T00:00:00').lte('created_at', to + 'T23:59:59'),
    ]);

    const result = { period: from === to ? from : `${from} → ${to}` };

    const journals = journalRes.data || [];
    if (journals.length) result.journals = journals.map(j => ({ date: j.date_key, content: j.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 500) }));

    const completed = completedRes.data || [];
    if (completed.length) result.completed = completed.map(c => `[${c.completed_date}] ${c.type}: ${c.text}${c.duration ? ' (' + c.duration + ')' : ''}`);

    const plan = planRes.data || [];
    if (plan.length) result.daily_plan = plan.map(p => `[${p.date_key}] ${p.done ? '✅' : '⬜'} #${p.slot} ${p.text} (${p.category || 'General'})`);

    const activity = activityRes.data || [];
    if (activity.length) result.activity = activity.map(a => `[${a.date_key}] ${a.activity} (${a.category || 'General'})${a.notes ? ' — ' + a.notes : ''}`);

    const expenses = expensesRes.data || [];
    if (expenses.length) {
        const total = expenses.reduce((s, e) => s + e.amount, 0);
        result.expenses = { total: total.toFixed(2), items: expenses.map(e => `[${e.date_key}] ${e.concept}: ${e.amount}€ (${e.category})`) };
    }

    const inbox = inboxRes.data || [];
    if (inbox.length) result.inbox = inbox.map(i => `${i.processed ? '✅' : '📥'} ${i.text}`);

    const content = contentRes.data || [];
    if (content.length) result.saved_content = content.map(c => `${c.reviewed ? '✅' : '👀'} [${c.topic}] ${c.title} (${c.source || 'unknown'})`);

    const reminders = remindersRes.data || [];
    if (reminders.length) result.reminders_created = reminders.map(r => `${r.done ? '✅' : '📌'} ${r.text}${r.due_date ? ' [' + r.due_date + ']' : ''} (${r.category || 'General'})`);

    const tasks = tasksRes.data || [];
    if (tasks.length) result.tasks_created = tasks.map(t => `${t.done ? '✅' : '⬜'} ${t.text} (${t.category || 'General'})`);

    const notes = notesRes.data || [];
    if (notes.length) result.notes = notes.map(n => `${n.text} (${n.category || 'General'})`);

    const totalItems = journals.length + completed.length + plan.length + activity.length + expenses.length + inbox.length + content.length + reminders.length + tasks.length + notes.length;
    if (totalItems === 0) return { message: `No activity found for ${result.period}` };

    result.summary = `${result.period}: ${completed.length} completed, ${reminders.length} reminders created, ${tasks.length} tasks created, ${activity.length} activities, ${expenses.length} expenses, ${inbox.length} inbox, ${content.length} content saved`;
    return result;
}

async function getAgenda({ date }) {
    const today = date || new Date().toISOString().split('T')[0];

    const [journalRes, remindersRes, tasksRes, planRes, projectsRes] = await Promise.all([
        supabase.from('journal').select('content').eq('date_key', today).single(),
        supabase.from('reminders').select('*').eq('done', false).order('position'),
        supabase.from('tasks').select('*').eq('done', false).order('position'),
        supabase.from('daily_plan').select('*').eq('date_key', today).order('slot'),
        supabase.from('projects').select('name, status, domain').eq('status', 'active').order('position'),
    ]);

    const allReminders = remindersRes.data || [];
    const todayReminders = allReminders.filter(r => r.due_date === today);
    const overdueReminders = allReminders.filter(r => r.due_date && r.due_date < today);

    // Next 7 days
    const next7date = new Date(today);
    next7date.setDate(next7date.getDate() + 7);
    const next7str = next7date.toISOString().split('T')[0];
    const thisWeek = allReminders.filter(r => r.due_date && r.due_date > today && r.due_date <= next7str);

    // Next 8-14 days
    const next14date = new Date(today);
    next14date.setDate(next14date.getDate() + 14);
    const next14str = next14date.toISOString().split('T')[0];
    const nextWeek = allReminders.filter(r => r.due_date && r.due_date > next7str && r.due_date <= next14str);

    return {
        date: today,
        journal: journalRes.data?.content || '(empty)',
        daily_plan: (planRes.data || []).map(t => `${t.done ? '✅' : '⬜'} [${t.category || 'General'}${t.priority ? '|'+t.priority : ''}] ${t.text}`),
        today_deadlines: todayReminders.map(r => r.text),
        overdue: overdueReminders.map(r => `${r.text} (was due ${r.due_date})`),
        this_week: thisWeek.map(r => `${r.text} [${r.due_date}]`),
        next_week: nextWeek.map(r => `${r.text} [${r.due_date}]`),
        all_reminders: allReminders.map(r => `${r.text}${r.due_date ? ` [${r.due_date}]` : ''}`),
        all_tasks: (tasksRes.data || []).map(t => `${t.text}${t.deadline ? ` [deadline: ${t.deadline}]` : ''}`),
        active_projects: (projectsRes.data || []).map(p => `[${p.domain}] ${p.name}${p.deadline ? ` (deadline: ${p.deadline})` : ''}`),
    };
}

// ── Semantic Query Expansion ─────────────────────────
async function expandQueryWithClaude(query) {
    try {
        const res = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 80,
            system: 'You expand search queries into synonyms. Return ONLY a raw JSON array (no markdown, no backticks, no explanation). Include the original term. Mix Spanish and English. Example input: "mi pareja" → ["mi pareja","novia","girlfriend","relación","partner"]',
            messages: [{ role: 'user', content: query }],
        });
        let text = res.content[0].text.trim();
        // Strip markdown code fences if present
        text = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) return parsed.slice(0, 6);
    } catch (e) {
        console.warn('[SEARCH] Query expansion failed:', e.message);
    }
    return [query]; // fallback to original
}

async function searchEntries({ query }) {
    // Expand query semantically
    const terms = await expandQueryWithClaude(query);
    console.log(`[SEARCH] Expanded "${query}" → ${JSON.stringify(terms)}`);

    // Build OR filter from expanded terms: "content.ilike.%term1%,content.ilike.%term2%"
    const orFilter = (col, ts) => ts.map(t => `${col}.ilike.%${t}%`).join(',');
    const orFilter2 = (col1, col2, ts) => ts.flatMap(t => [`${col1}.ilike.%${t}%`, `${col2}.ilike.%${t}%`]).join(',');

    const [journalRes, remindersRes, tasksRes, projectsRes, inboxRes,
           completedRes, notesRes, activityRes, contentRes, expensesRes,
           memoryRes, recurringRes] = await Promise.all([
        supabase.from('journal').select('date_key, content').or(orFilter('content', terms)).order('date_key', { ascending: false }).limit(10),
        supabase.from('reminders').select('text, due_date, category, done').or(orFilter('text', terms)).limit(10),
        supabase.from('tasks').select('text, deadline, category, done').or(orFilter('text', terms)).limit(10),
        supabase.from('projects').select('name, domain, status, objective').or(orFilter2('name', 'objective', terms)).limit(10),
        supabase.from('inbox').select('text, created_at, processed').or(orFilter('text', terms)).order('created_at', { ascending: false }).limit(10),
        supabase.from('completed').select('text, type, completed_date, duration').or(orFilter('text', terms)).order('completed_date', { ascending: false }).limit(10),
        supabase.from('notes').select('text, category, created_at').or(orFilter('text', terms)).order('created_at', { ascending: false }).limit(10),
        supabase.from('activity_log').select('activity, category, date_key, notes').or(orFilter('activity', terms)).order('date_key', { ascending: false }).limit(10),
        supabase.from('saved_content').select('title, topic, source, url, reviewed, created_at').or(orFilter('title', terms)).order('created_at', { ascending: false }).limit(10),
        supabase.from('expenses').select('concept, amount, category, date_key').or(orFilter('concept', terms)).order('date_key', { ascending: false }).limit(10),
        supabase.from('kaira_memory').select('category, key, value').or(orFilter2('key', 'value', terms)).limit(10),
        supabase.from('recurring_reminders').select('text, frequency, day_of_week, day_of_month, active').or(orFilter('text', terms)).limit(10),
    ]);

    // Deduplicate projects
    const uniqueProjects = (projectsRes.data || []).filter((p, i, arr) => arr.findIndex(x => x.name === p.name) === i);

    return {
        journal: (journalRes.data || []).map(j => ({ date: j.date_key, preview: j.content.substring(0, 300) })),
        reminders: remindersRes.data || [],
        tasks: tasksRes.data || [],
        projects: uniqueProjects,
        inbox: inboxRes.data || [],
        completed: (completedRes.data || []).map(c => ({ date: c.completed_date, type: c.type, text: c.text, duration: c.duration })),
        notes: notesRes.data || [],
        activity: (activityRes.data || []).map(a => ({ date: a.date_key, activity: a.activity, category: a.category, notes: a.notes })),
        saved_content: contentRes.data || [],
        expenses: (expensesRes.data || []).map(e => ({ date: e.date_key, concept: e.concept, amount: e.amount, category: e.category })),
        memory: memoryRes.data || [],
        recurring: recurringRes.data || [],
    };
}

// ── V2 Functions ────────────────────────────────────────

async function createProject({ name, domain, project_type, objective, deadline }) {
    const { data: maxPos } = await supabase
        .from('projects').select('position')
        .order('position', { ascending: false }).limit(1).single();

    const row = {
        name,
        domain: domain || 'Personal',
        project_type: project_type || 'temporal',
        objective: objective || '',
        position: (maxPos?.position || 0) + 1,
    };
    if (deadline) row.deadline = deadline;

    const { data, error } = await supabase
        .from('projects').insert(row).select().single();

    if (error) return { error: error.message };
    return { success: true, message: `Project created: "${name}" [${domain}]${deadline ? ` deadline: ${deadline}` : ''}`, project_id: data.id };
}

async function updateProject({ search_name, status, project_type, objective, notes, deadline }) {
    const { data: projects } = await supabase
        .from('projects').select('*')
        .ilike('name', `%${search_name}%`)
        .limit(1);

    if (!projects?.length) return { error: `No project found matching "${search_name}"` };

    const project = projects[0];
    // Permanent projects cannot be marked as done
    if (status === 'done' && (project.project_type || 'temporal') === 'permanent') {
        return { error: `Project "${project.name}" is permanent and cannot be marked as done` };
    }
    const update = {};
    if (status) {
        update.status = status;
        if (status === 'done') update.completed_at = new Date().toISOString();
    }
    if (project_type) update.project_type = project_type;
    if (objective) update.objective = objective;
    if (notes) update.notes = project.notes ? project.notes + '\n' + notes : notes;
    if (deadline !== undefined) update.deadline = deadline || null;

    const { error } = await supabase
        .from('projects').update(update).eq('id', project.id);

    if (error) return { error: error.message };
    return { success: true, message: `Project "${project.name}" updated` };
}

async function addToInbox({ text }) {
    const { data, error } = await supabase
        .from('inbox').insert({ text }).select().single();

    if (error) return { error: error.message };
    return { success: true, message: `Added to inbox: "${text}"` };
}

async function setDailyPlan({ slot, text, category, project_id, energy, priority }) {
    const today = new Date().toISOString().split('T')[0];
    const row = { date_key: today, slot, text, energy: energy || 'quick', done: false, source: 'manual' };
    if (category) row.category = category;
    if (project_id) row.project_id = project_id;
    if (priority) row.priority = priority;

    const { data, error } = await supabase
        .from('daily_plan')
        .upsert(row, { onConflict: 'date_key,slot' })
        .select().single();

    if (error) return { error: error.message };
    return { success: true, message: `Plan slot ${slot}: "${text}" [${category || 'General'}]` };
}

async function buildDailyPlan({ date }) {
    const today = date || new Date().toISOString().split('T')[0];
    const tomorrow = new Date(new Date(today).getTime() + 86400000).toISOString().split('T')[0];

    const [remindersRes, tasksRes, projectsRes, contentRes, yesterdayPlanRes] = await Promise.all([
        supabase.from('reminders').select('*').eq('done', false).order('position'),
        supabase.from('tasks').select('*').eq('done', false).order('position'),
        supabase.from('projects').select('*').eq('status', 'active').order('position'),
        supabase.from('saved_content').select('id, title, topic').eq('reviewed', false).limit(5),
        supabase.from('daily_plan').select('*').eq('date_key', new Date(new Date(today).getTime() - 86400000).toISOString().split('T')[0]).eq('done', false),
    ]);

    const allReminders = remindersRes.data || [];
    const overdue = allReminders.filter(r => r.due_date && r.due_date < today);
    const todayDeadlines = allReminders.filter(r => r.due_date === today);
    const redPriority = allReminders.filter(r => r.priority === 'red' && !r.due_date);
    const yellowPriority = allReminders.filter(r => r.priority === 'yellow');
    const unfinishedYesterday = yesterdayPlanRes.data || [];
    const pendingContent = contentRes.data || [];
    const blockedProjects = (projectsRes.data || []).filter(p => p.status === 'blocked');

    return {
        date: today,
        overdue: overdue.map(r => `🔴 ${r.text} (was due ${r.due_date}) [${r.category || 'General'}]`),
        today_deadlines: todayDeadlines.map(r => `📌 ${r.text} [${r.category || 'General'}]`),
        urgent: redPriority.map(r => `🔴 ${r.text} [${r.category || 'General'}]`),
        attention: yellowPriority.map(r => `🟡 ${r.text} [${r.category || 'General'}]`),
        unfinished_yesterday: unfinishedYesterday.map(p => `⏳ ${p.text} [${p.category || 'General'}]`),
        active_projects: (projectsRes.data || []).map(p => `[${p.domain}] ${p.name}`),
        pending_content: pendingContent.map(c => `📺 [${c.topic}] ${c.title}`),
        pending_tasks: (tasksRes.data || []).slice(0, 10).map(t => `${t.priority ? (t.priority === 'red' ? '🔴' : t.priority === 'yellow' ? '🟡' : '🟢') : '⬜'} ${t.text} [${t.category || 'General'}]`),
        suggestion: 'Use this data to create a daily plan (set_daily_plan) with up to 10 items, ordered by priority and urgency. Mix categories. Include at least 1 personal/review item if available.',
    };
}

async function movePlanItem({ search_text, new_date }) {
    const today = new Date().toISOString().split('T')[0];
    const { data: items } = await supabase.from('daily_plan').select('*')
        .eq('date_key', today).ilike('text', `%${search_text}%`).limit(1);
    if (!items?.length) return { error: `Plan item "${search_text}" not found for today` };

    // Find next available slot on new date
    const { data: existing } = await supabase.from('daily_plan').select('slot')
        .eq('date_key', new_date).order('slot', { ascending: false }).limit(1);
    const nextSlot = (existing?.[0]?.slot || 0) + 1;
    if (nextSlot > 10) return { error: 'Target date already has 10 items' };

    const item = items[0];
    await supabase.from('daily_plan').delete().eq('id', item.id);
    await supabase.from('daily_plan').insert({
        date_key: new_date, slot: nextSlot, text: item.text,
        category: item.category, project_id: item.project_id,
        energy: item.energy, priority: item.priority, done: false, source: item.source,
    });

    return { success: true, message: `Moved "${item.text}" to ${new_date}` };
}

async function getProjectDocs({ search_name }) {
    const { data: projects } = await supabase.from('projects').select('*')
        .ilike('name', `%${search_name}%`).limit(1);
    if (!projects?.length) return { error: `Project "${search_name}" not found` };
    const project = projects[0];

    const [journalRes, notesRes, tasksRes, remindersRes, projNotesRes] = await Promise.all([
        supabase.from('journal').select('date_key, content, category').eq('project_id', project.id).order('date_key', { ascending: false }).limit(20),
        supabase.from('notes').select('*').eq('project_id', project.id).order('created_at', { ascending: false }),
        supabase.from('tasks').select('*').eq('project_id', project.id).order('position'),
        supabase.from('reminders').select('*').eq('project_id', project.id).order('position'),
        supabase.from('project_notes').select('*').eq('project_id', project.id).order('created_at', { ascending: false }).limit(20),
    ]);

    return {
        project: { name: project.name, domain: project.domain, status: project.status, objective: project.objective, notes: project.notes },
        journal_entries: (journalRes.data || []).map(j => `${j.date_key}: ${j.content.substring(0, 300)}`),
        notes: (notesRes.data || []).map(n => `📌 ${n.text}`),
        project_notes: (projNotesRes.data || []).map(n => `[${new Date(n.created_at).toISOString().split('T')[0]}] ${n.content}`),
        tasks: (tasksRes.data || []).map(t => `${t.done ? '✅' : '⬜'} ${t.text}`),
        reminders: (remindersRes.data || []).map(r => `${r.done ? '✅' : '⬜'} ${r.text}${r.due_date ? ` [${r.due_date}]` : ''}`),
    };
}

async function addNote({ text, category, project_id, color, pinned }) {
    const row = { text, category: category || 'General' };
    if (project_id) row.project_id = project_id;
    if (color) row.color = color;
    if (pinned) row.pinned = pinned;

    const { error } = await supabase.from('notes').insert(row);
    if (error) return { error: error.message };
    return { success: true, message: `Note added: "${text}" [${category || 'General'}]` };
}

async function getNotes({ category, project_id }) {
    let query = supabase.from('notes').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false });
    if (category) query = query.eq('category', category);
    if (project_id) query = query.eq('project_id', project_id);
    const { data } = await query.limit(30);
    return { notes: (data || []).map(n => `${n.pinned ? '📍' : '📌'} [${n.category}] ${n.text}`) };
}

async function deleteNote({ search_text }) {
    const { data: found } = await supabase.from('notes').select('id, text')
        .ilike('text', `%${search_text}%`).limit(1);
    if (!found?.length) return { error: `Note "${search_text}" not found` };
    await supabase.from('notes').delete().eq('id', found[0].id);
    return { success: true, message: `Note deleted: "${found[0].text}"` };
}

async function getBriefing() {
    const today = new Date().toISOString().split('T')[0];

    const [planRes, remindersRes, tasksRes, projectsRes, inboxRes, contentRes] = await Promise.all([
        supabase.from('daily_plan').select('*').eq('date_key', today).order('slot'),
        supabase.from('reminders').select('*').eq('done', false).order('position'),
        supabase.from('tasks').select('*').eq('done', false).order('position'),
        supabase.from('projects').select('*').neq('status', 'done').order('position'),
        supabase.from('inbox').select('id').eq('processed', false),
        supabase.from('saved_content').select('id').eq('reviewed', false),
    ]);

    const allReminders = remindersRes.data || [];
    const todayDeadlines = allReminders.filter(r => r.due_date === today);
    const overdue = allReminders.filter(r => r.due_date && r.due_date < today);
    const next3days = allReminders.filter(r => {
        if (!r.due_date) return false;
        const diff = (new Date(r.due_date) - new Date(today)) / 86400000;
        return diff > 0 && diff <= 3;
    });
    const next7days = allReminders.filter(r => {
        if (!r.due_date) return false;
        const diff = (new Date(r.due_date) - new Date(today)) / 86400000;
        return diff > 3 && diff <= 7;
    });
    const next30days = allReminders.filter(r => {
        if (!r.due_date) return false;
        const diff = (new Date(r.due_date) - new Date(today)) / 86400000;
        return diff > 7 && diff <= 30;
    });

    const activeProjects = (projectsRes.data || []).filter(p => p.status === 'active');
    const blockedProjects = (projectsRes.data || []).filter(p => p.status === 'blocked');

    return {
        date: today,
        daily_plan: (planRes.data || []).map(t => `${t.done ? '✅' : '⬜'} #${t.slot} [${t.category}${t.priority ? '|'+t.priority : ''}] ${t.text}`),
        today_deadlines: todayDeadlines.map(r => `${r.priority === 'red' ? '🔴' : r.priority === 'yellow' ? '🟡' : '📌'} ${r.text} [${r.category || 'General'}]`),
        overdue: overdue.map(r => `🔴 ${r.text} (due ${r.due_date}) [${r.category || 'General'}]`),
        next_3_days: next3days.map(r => `${r.text} [${r.due_date}] [${r.category || 'General'}]`),
        next_7_days: next7days.map(r => `${r.text} [${r.due_date}] [${r.category || 'General'}]`),
        next_30_days: next30days.map(r => `${r.text} [${r.due_date}] [${r.category || 'General'}]`),
        active_projects: activeProjects.map(p => `[${p.domain}] ${p.name}`),
        blocked_projects: blockedProjects.map(p => `[${p.domain}] ${p.name}`),
        pending_tasks: (tasksRes.data || []).length,
        inbox_unprocessed: (inboxRes.data || []).length,
        pending_content: (contentRes.data || []).length,
    };
}

// ── Expenses ────────────────────────────────────────

async function logExpense({ concept, amount, category, date, notes }) {
    const { data, error } = await supabase
        .from('expenses')
        .insert({
            concept,
            amount: parseFloat(amount),
            category: category || 'General',
            date_key: date || new Date().toISOString().split('T')[0],
            notes: notes || '',
        })
        .select().single();

    if (error) return { error: error.message };
    return { success: true, message: `Gasto registrado: ${concept} — ${amount}€ [${category}]` };
}

async function getExpenses({ category, period }) {
    const today = new Date();
    let from, to;

    switch (period || 'this_month') {
        case 'today':
            from = to = today.toISOString().split('T')[0];
            break;
        case 'this_week': {
            const dow = today.getDay() || 7;
            const monday = new Date(today);
            monday.setDate(today.getDate() - dow + 1);
            from = monday.toISOString().split('T')[0];
            to = today.toISOString().split('T')[0];
            break;
        }
        case 'this_month':
            from = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
            to = today.toISOString().split('T')[0];
            break;
        case 'last_month': {
            const lm = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const lmEnd = new Date(today.getFullYear(), today.getMonth(), 0);
            from = lm.toISOString().split('T')[0];
            to = lmEnd.toISOString().split('T')[0];
            break;
        }
        case 'all':
            from = '2020-01-01';
            to = '2099-12-31';
            break;
        default:
            from = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
            to = today.toISOString().split('T')[0];
    }

    let query = supabase.from('expenses').select('*')
        .gte('date_key', from).lte('date_key', to)
        .order('date_key', { ascending: false });

    if (category) query = query.ilike('category', `%${category}%`);

    const { data, error } = await query;
    if (error) return { error: error.message };

    const expenses = data || [];
    const total = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);

    // Group by category
    const byCategory = {};
    expenses.forEach(e => {
        if (!byCategory[e.category]) byCategory[e.category] = 0;
        byCategory[e.category] += parseFloat(e.amount);
    });

    return {
        period: `${from} → ${to}`,
        total: `${total.toFixed(2)}€`,
        count: expenses.length,
        by_category: Object.entries(byCategory).map(([cat, amt]) => `${cat}: ${amt.toFixed(2)}€`),
        recent: expenses.slice(0, 10).map(e => `${e.date_key} | ${e.concept}: ${e.amount}€ [${e.category}]`),
    };
}

// ══════════════════════════════════════════════════════
// V3 Functions
// ══════════════════════════════════════════════════════

// ── Memory ──────────────────────────────────────────

async function saveMemory({ category, key, value }) {
    const { data: existing } = await supabase.from('kaira_memory').select('id').eq('key', key).limit(1);
    let result;
    if (existing?.length) {
        result = await supabase.from('kaira_memory').update({ value, category }).eq('id', existing[0].id).select().single();
    } else {
        result = await supabase.from('kaira_memory').insert({ category, key, value }).select().single();
    }
    if (result.error) return { error: result.error.message };
    return { success: true, message: `Remembered: ${key} = ${value}` };
}

async function recallMemory({ query }) {
    // Expand query semantically for better recall
    const terms = await expandQueryWithClaude(query);
    console.log(`[MEMORY] Expanded "${query}" → ${JSON.stringify(terms)}`);
    const orConds = terms.flatMap(t => [`key.ilike.%${t}%`, `value.ilike.%${t}%`, `category.ilike.%${t}%`]).join(',');
    const { data } = await supabase.from('kaira_memory').select('*').or(orConds).limit(20);
    if (!data?.length) return { results: [], message: 'No memories found' };
    return { results: data.map(m => `[${m.category}] ${m.key}: ${m.value}`) };
}

// Exported for system prompt injection
export async function getAllMemories() {
    const { data } = await supabase.from('kaira_memory').select('category, key, value').order('category');
    return data || [];
}

// ── Lists ───────────────────────────────────────────

async function manageList({ action, list_name, items, item_text }) {
    const normalized = list_name.toLowerCase().trim();

    switch (action) {
        case 'create': {
            const { data, error } = await supabase.from('lists').insert({ name: normalized }).select().single();
            if (error) return { error: error.message };
            return { success: true, message: `List "${normalized}" created` };
        }
        case 'add': {
            let { data: list } = await supabase.from('lists').select('id').eq('name', normalized).single();
            if (!list) {
                const res = await supabase.from('lists').insert({ name: normalized }).select().single();
                list = res.data;
            }
            const toAdd = items || (item_text ? [item_text] : []);
            for (const text of toAdd) {
                await supabase.from('list_items').insert({ list_id: list.id, text });
            }
            return { success: true, message: `Added ${toAdd.length} item(s) to "${normalized}": ${toAdd.join(', ')}` };
        }
        case 'get': {
            const { data: list } = await supabase.from('lists').select('id, name').eq('name', normalized).single();
            if (!list) return { error: `List "${normalized}" not found` };
            const { data: listItems } = await supabase.from('list_items').select('*').eq('list_id', list.id).order('position');
            return {
                list: normalized,
                items: (listItems || []).map(i => `${i.done ? '✅' : '⬜'} ${i.text}`),
                total: listItems?.length || 0,
                done: (listItems || []).filter(i => i.done).length,
            };
        }
        case 'check': {
            const { data: list } = await supabase.from('lists').select('id').eq('name', normalized).single();
            if (!list) return { error: `List "${normalized}" not found` };
            const { data: found } = await supabase.from('list_items').select('id, text')
                .eq('list_id', list.id).ilike('text', `%${item_text}%`).eq('done', false).limit(1);
            if (!found?.length) return { error: `Item "${item_text}" not found in list` };
            await supabase.from('list_items').update({ done: true }).eq('id', found[0].id);
            return { success: true, message: `Checked off: "${found[0].text}"` };
        }
        case 'remove_item': {
            const { data: list } = await supabase.from('lists').select('id').eq('name', normalized).single();
            if (!list) return { error: `List "${normalized}" not found` };
            const { data: found } = await supabase.from('list_items').select('id, text')
                .eq('list_id', list.id).ilike('text', `%${item_text}%`).limit(1);
            if (!found?.length) return { error: `Item "${item_text}" not found` };
            await supabase.from('list_items').delete().eq('id', found[0].id);
            return { success: true, message: `Removed: "${found[0].text}"` };
        }
        case 'delete_list': {
            await supabase.from('lists').delete().eq('name', normalized);
            return { success: true, message: `List "${normalized}" deleted` };
        }
        default:
            return { error: `Unknown list action: ${action}` };
    }
}

// ── Activity Log / Diary ────────────────────────────

async function logActivity({ activity, category, date, notes }) {
    const { data, error } = await supabase.from('activity_log')
        .insert({ activity, category: category || 'General', date_key: date || new Date().toISOString().split('T')[0], notes: notes || '' })
        .select().single();
    if (error) return { error: error.message };
    return { success: true, message: `Logged: ${activity} [${category || 'General'}]` };
}

async function getActivitySummary({ category, period, search }) {
    const today = new Date();
    let from, to;

    switch (period) {
        case 'today': from = to = today.toISOString().split('T')[0]; break;
        case 'this_week': {
            const d = today.getDay() || 7;
            const mon = new Date(today); mon.setDate(today.getDate() - d + 1);
            from = mon.toISOString().split('T')[0]; to = today.toISOString().split('T')[0]; break;
        }
        case 'this_month': from = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-01`; to = today.toISOString().split('T')[0]; break;
        case 'last_month': {
            const lm = new Date(today.getFullYear(), today.getMonth()-1, 1);
            const lmEnd = new Date(today.getFullYear(), today.getMonth(), 0);
            from = lm.toISOString().split('T')[0]; to = lmEnd.toISOString().split('T')[0]; break;
        }
        case 'last_7_days': {
            const d7 = new Date(today); d7.setDate(d7.getDate()-7);
            from = d7.toISOString().split('T')[0]; to = today.toISOString().split('T')[0]; break;
        }
        case 'last_30_days': {
            const d30 = new Date(today); d30.setDate(d30.getDate()-30);
            from = d30.toISOString().split('T')[0]; to = today.toISOString().split('T')[0]; break;
        }
        default: from = `${today.getFullYear()}-01-01`; to = today.toISOString().split('T')[0];
    }

    let query = supabase.from('activity_log').select('*').gte('date_key', from).lte('date_key', to).order('date_key', { ascending: false });
    if (category) query = query.ilike('category', `%${category}%`);
    if (search) query = query.ilike('activity', `%${search}%`);

    const { data } = await query;
    const activities = data || [];

    const byCat = {};
    activities.forEach(a => { byCat[a.category] = (byCat[a.category] || 0) + 1; });

    return {
        period: `${from} → ${to}`,
        total_activities: activities.length,
        by_category: Object.entries(byCat).map(([c, n]) => `${c}: ${n} veces`),
        recent: activities.slice(0, 15).map(a => `${a.date_key} | ${a.activity} [${a.category}]${a.notes ? ' — '+a.notes : ''}`),
    };
}

// ── Saved Content ───────────────────────────────────

async function saveContent({ title, url, topic, source, notes }) {
    const { data, error } = await supabase.from('saved_content')
        .insert({ title, url: url || '', topic: topic || 'General', source: source || '', notes: notes || '' })
        .select().single();
    if (error) return { error: error.message };
    return { success: true, message: `Saved: "${title}" [${topic}]${source ? ' from '+source : ''}` };
}

async function getSavedContent({ topic, only_unreviewed }) {
    let query = supabase.from('saved_content').select('*').order('created_at', { ascending: false });
    if (topic) query = query.ilike('topic', `%${topic}%`);
    if (only_unreviewed !== false) query = query.eq('reviewed', false);
    const { data } = await query.limit(20);
    const items = data || [];
    return {
        count: items.length,
        items: items.map(i => `${i.reviewed ? '✅' : '📌'} [${i.topic}] ${i.title}${i.url ? ' — '+i.url : ''}${i.source ? ' ('+i.source+')' : ''}`),
    };
}

async function markContentReviewed({ search_title }) {
    const { data: found } = await supabase.from('saved_content').select('id, title')
        .ilike('title', `%${search_title}%`).eq('reviewed', false).limit(1);
    if (!found?.length) return { error: `Content "${search_title}" not found` };
    await supabase.from('saved_content').update({ reviewed: true }).eq('id', found[0].id);
    return { success: true, message: `Marked as reviewed: "${found[0].title}"` };
}

// ── Recurring Reminders ─────────────────────────────

async function createRecurring({ text, frequency, day_of_week, day_of_month }) {
    const { data, error } = await supabase.from('recurring_reminders')
        .insert({ text, frequency, day_of_week: day_of_week || null, day_of_month: day_of_month || null })
        .select().single();
    if (error) return { error: error.message };
    const desc = frequency === 'weekly' ? `every ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][day_of_week] || frequency}` :
                 frequency === 'monthly' ? `every month on day ${day_of_month}` : frequency;
    return { success: true, message: `Recurring created: "${text}" (${desc})` };
}

async function listRecurring() {
    const { data } = await supabase.from('recurring_reminders').select('*').eq('active', true).order('created_at');
    if (!data?.length) return { recurring: [], message: 'No recurring reminders' };
    return {
        recurring: data.map(r => {
            const desc = r.frequency === 'weekly' ? `${['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][r.day_of_week] || r.frequency}` :
                         r.frequency === 'monthly' ? `día ${r.day_of_month}` : r.frequency;
            return `${r.text} — ${desc}${r.last_triggered ? ` (last: ${r.last_triggered})` : ''}`;
        }),
    };
}

// ── URL Summarizer ──────────────────────────────────

async function summarizeUrl({ url, topic }) {
    const { Readability } = await import('@mozilla/readability');
    const { JSDOM } = await import('jsdom');

    try {
        // Fetch the page
        const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KairosBot/1.0)' },
            signal: AbortSignal.timeout(10000),
        });
        const html = await response.text();

        // Extract article text
        const dom = new JSDOM(html, { url });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();

        if (!article || !article.textContent) {
            return { error: 'Could not extract article content from this URL' };
        }

        const title = article.title || 'Untitled';
        const textContent = article.textContent.substring(0, 3000); // Limit for Claude

        // Summarize with Claude
        const Anthropic = (await import('@anthropic-ai/sdk')).default;
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

        const summaryResponse = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 500,
            messages: [{
                role: 'user',
                content: `Summarize this article in 3-5 bullet points in Spanish. Be concise and extract the key insights:\n\nTitle: ${title}\n\nContent: ${textContent}`
            }]
        });

        const summary = summaryResponse.content[0]?.text || 'No summary generated';

        // Detect source
        let source = 'Web';
        if (url.includes('youtube') || url.includes('youtu.be')) source = 'YouTube';
        else if (url.includes('twitter') || url.includes('x.com')) source = 'Twitter/X';
        else if (url.includes('instagram')) source = 'Instagram';
        else if (url.includes('tiktok')) source = 'TikTok';
        else if (url.includes('reddit')) source = 'Reddit';

        // Save to Watch Later
        await supabase.from('saved_content').insert({
            title,
            url,
            topic: topic || 'General',
            source,
            notes: summary,
        });

        return {
            success: true,
            title,
            summary,
            message: `Summarized and saved: "${title}"`
        };
    } catch (err) {
        return { error: `Failed to fetch/summarize URL: ${err.message}` };
    }
}

// ── V4 Functions ────────────────────────────────────────

async function processInbox({ search_text, action }) {
    const { data: items } = await supabase.from('inbox').select('id, text')
        .ilike('text', `%${search_text}%`).limit(1);
    if (!items?.length) return { error: `No inbox item found matching "${search_text}"` };

    if (action === 'delete') {
        await supabase.from('inbox').delete().eq('id', items[0].id);
        return { success: true, message: `Deleted from inbox: "${items[0].text}"` };
    } else {
        await supabase.from('inbox').update({ processed: true }).eq('id', items[0].id);
        return { success: true, message: `Processed: "${items[0].text}"` };
    }
}

async function getCompleted({ period, limit: maxItems, category, date_from, date_to }) {
    const today = new Date().toISOString().split('T')[0];
    let query = supabase.from('completed').select('*').order('completed_date', { ascending: false });

    // Custom date range takes priority
    if (date_from && date_to) {
        query = query.gte('completed_date', date_from).lte('completed_date', date_to);
    } else if (date_from) {
        query = query.gte('completed_date', date_from);
    } else if (period === 'today') {
        query = query.eq('completed_date', today);
    } else if (period === 'this_week' || period === 'last_7_days') {
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
        query = query.gte('completed_date', weekAgo);
    } else if (period === 'this_month') {
        const monthStart = today.substring(0, 7) + '-01';
        query = query.gte('completed_date', monthStart);
    }

    if (category) query = query.ilike('type', `%${category}%`);

    query = query.limit(maxItems || 20);
    const { data } = await query;

    if (!data?.length) return { message: 'No completed items found for this period' };
    return {
        count: data.length,
        items: data.map(c => `${c.completed_date || ''}: [${c.type}] ${c.text}${c.duration ? ' (' + c.duration + ')' : ''}`)
    };
}

async function editTask({ search_text, new_text, deadline, category, priority }) {
    const { data: items } = await supabase.from('tasks').select('*')
        .ilike('text', `%${search_text}%`).eq('done', false).limit(1);
    if (!items?.length) return { error: `No task found matching "${search_text}"` };

    const update = {};
    if (new_text) update.text = new_text;
    if (deadline !== undefined) update.deadline = deadline || null;
    if (category) update.category = category;
    if (priority) update.priority = priority;

    if (Object.keys(update).length === 0) return { error: 'Nothing to update' };

    await supabase.from('tasks').update(update).eq('id', items[0].id);
    return { success: true, message: `Task updated: "${items[0].text}" → ${JSON.stringify(update)}` };
}

async function editReminder({ search_text, new_text, due_date, due_time, category, priority }) {
    const { data: items } = await supabase.from('reminders').select('*')
        .ilike('text', `%${search_text}%`).eq('done', false).limit(1);
    if (!items?.length) return { error: `No reminder found matching "${search_text}"` };

    const update = {};
    if (new_text) update.text = new_text;
    if (due_date !== undefined) update.due_date = due_date || null;
    if (due_time !== undefined) {
        update.due_time = due_time || null;
        update.alert_sent = false; // reset alert when time changes
    }
    if (category) update.category = category;
    if (priority) update.priority = priority;

    if (Object.keys(update).length === 0) return { error: 'Nothing to update' };

    await supabase.from('reminders').update(update).eq('id', items[0].id);
    return { success: true, message: `Reminder updated: "${items[0].text}" → ${JSON.stringify(update)}` };
}

async function deletePlanItem({ search_text }) {
    const today = new Date().toISOString().split('T')[0];
    const { data: items } = await supabase.from('daily_plan').select('id, text')
        .eq('date_key', today).ilike('text', `%${search_text}%`).limit(1);
    if (!items?.length) return { error: `No plan item found matching "${search_text}"` };

    await supabase.from('daily_plan').delete().eq('id', items[0].id);
    return { success: true, message: `Removed from plan: "${items[0].text}"` };
}

// ── Day Sessions (4-block daily plan) ─────────────────

const SLOT_LABELS = {
    morning: '🌅 Morning (08:00–11:30)',
    afternoon: '☀️ Afternoon (11:30–14:30)',
    evening: '🌆 Evening (17:00–19:30)',
    night: '🌙 Early Night (19:30–23:00)',
};

const STUDY_KEYWORDS = [
    'investigar', 'aprender', 'estudiar', 'research', 'learn', 'study', 'leer', 'read',
    'curso', 'course', 'tutorial', 'formación', 'training', 'documentar', 'explorar',
    'analizar', 'profundizar', 'repasar', 'review', 'skill', 'skills',
];

function looksLikeEstudio(text) {
    const lower = (text || '').toLowerCase();
    return STUDY_KEYWORDS.some(kw => lower.includes(kw));
}

async function setDaySession({ slot, domain, project_id, focus_text, date }) {
    const dateKey = date || new Date().toISOString().split('T')[0];

    // Get next position
    const { data: maxPos } = await supabase
        .from('day_sessions').select('position')
        .eq('date_key', dateKey).eq('slot', slot)
        .order('position', { ascending: false }).limit(1).single();

    const row = { date_key: dateKey, slot, domain, position: (maxPos?.position || 0) + 1 };
    if (project_id) row.project_id = project_id;
    if (focus_text) row.focus_text = focus_text;

    const { data, error } = await supabase
        .from('day_sessions').insert(row).select().single();

    if (error) return { error: error.message };
    return { success: true, message: `Added to ${SLOT_LABELS[slot]}: ${domain}${focus_text ? ' — ' + focus_text : ''}` };
}

async function editDaySession({ search_text, slot, domain, focus_text, date }) {
    const dateKey = date || new Date().toISOString().split('T')[0];

    const { data: items } = await supabase
        .from('day_sessions').select('*')
        .eq('date_key', dateKey)
        .ilike('focus_text', `%${search_text}%`)
        .limit(1);

    if (!items?.length) return { error: `No session item found matching "${search_text}"` };

    const update = {};
    if (slot) update.slot = slot;
    if (domain) update.domain = domain;
    if (focus_text) update.focus_text = focus_text;

    const { error } = await supabase.from('day_sessions').update(update).eq('id', items[0].id);
    if (error) return { error: error.message };
    return { success: true, message: `Session item updated: "${items[0].focus_text}" → ${JSON.stringify(update)}` };
}

async function deleteDaySessionItem({ search_text, date }) {
    const dateKey = date || new Date().toISOString().split('T')[0];

    const { data: items } = await supabase
        .from('day_sessions').select('*')
        .eq('date_key', dateKey)
        .ilike('focus_text', `%${search_text}%`)
        .limit(1);

    if (!items?.length) return { error: `No session item found matching "${search_text}"` };

    const { error } = await supabase.from('day_sessions').delete().eq('id', items[0].id);
    if (error) return { error: error.message };
    return { success: true, message: `Deleted from ${SLOT_LABELS[items[0].slot]}: "${items[0].focus_text}"` };
}

async function clearDaySession({ slot, date }) {
    const dateKey = date || new Date().toISOString().split('T')[0];
    const { error } = await supabase
        .from('day_sessions')
        .delete()
        .eq('date_key', dateKey)
        .eq('slot', slot);

    if (error) return { error: error.message };
    return { success: true, message: `${SLOT_LABELS[slot]} cleared (all items)` };
}

async function getDaySessions({ date }) {
    const dateKey = date || new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
        .from('day_sessions')
        .select('*, projects(name)')
        .eq('date_key', dateKey)
        .order('slot')
        .order('position');

    if (error) return { error: error.message };
    if (!data?.length) return { message: 'No day plan set yet. Use build_day_sessions to create one.' };

    const slots = ['morning', 'afternoon', 'evening', 'night'];
    const result = {};
    for (const s of slots) {
        const items = data.filter(d => d.slot === s);
        if (items.length) {
            result[s] = {
                label: SLOT_LABELS[s],
                items: items.map(i => ({
                    domain: i.domain,
                    project: i.projects?.name || null,
                    focus: i.focus_text || null,
                })),
            };
        } else {
            result[s] = { label: SLOT_LABELS[s], items: [], note: 'Empty — free block' };
        }
    }
    return result;
}

async function buildDaySessions({ date }) {
    const today = date || new Date().toISOString().split('T')[0];

    // Gather all office state
    const [remindersRes, tasksRes, projectsRes, contentRes, inboxRes, yesterdayPlanRes] = await Promise.all([
        supabase.from('reminders').select('*').eq('done', false).order('position'),
        supabase.from('tasks').select('*').eq('done', false).order('position'),
        supabase.from('projects').select('*').eq('status', 'active'),
        supabase.from('saved_content').select('id, title, topic').eq('reviewed', false).limit(20),
        supabase.from('inbox').select('*').eq('processed', false),
        supabase.from('day_sessions').select('*').eq('date_key',
            new Date(new Date(today).getTime() - 86400000).toISOString().split('T')[0]),
    ]);

    const reminders = remindersRes.data || [];
    const tasks = tasksRes.data || [];
    const projects = projectsRes.data || [];
    const content = contentRes.data || [];
    const inbox = inboxRes.data || [];

    // Detect study needs from inbox and tasks
    const studyItems = [
        ...tasks.filter(t => looksLikeEstudio(t.text)),
        ...inbox.filter(i => looksLikeEstudio(i.text)),
    ];
    const hasStudyNeeds = studyItems.length > 0 || content.length >= 5;

    // Build context for AI
    const overdue = reminders.filter(r => r.due_date && r.due_date < today);
    const todayDeadlines = reminders.filter(r => r.due_date === today);
    const urgentRed = [...reminders.filter(r => r.priority === 'red'), ...tasks.filter(t => t.priority === 'red')];

    const context = {
        overdue: overdue.map(r => `🔴 OVERDUE: ${r.text} [${r.category || 'General'}] (was due ${r.due_date})`),
        today_deadlines: todayDeadlines.map(r => `📌 TODAY: ${r.text} [${r.category || 'General'}]`),
        urgent: urgentRed.map(r => `🔴 URGENT: ${r.text} [${r.category || 'General'}]`),
        active_projects: projects.map(p => `[${p.domain}] ${p.name}`),
        pending_watch_later: `${content.length} items pending review`,
        study_items: studyItems.map(i => `📚 ${i.text}`),
        has_study_needs: hasStudyNeeds,
        pending_tasks_by_category: (() => {
            const cats = {};
            tasks.forEach(t => { const c = t.category || 'General'; cats[c] = (cats[c] || 0) + 1; });
            return cats;
        })(),
        pending_inbox: inbox.length,
    };

    return {
        date: today,
        office_state: context,
        slots: {
            morning: '08:00–11:30 (best for deep work)',
            afternoon: '11:30–14:30 (good for management/meetings)',
            evening: '17:00–19:30 (good for creative/study)',
            night: '19:30–23:00 (good for personal/review)',
        },
        domains: ['Trading', 'Dev', 'Bets', 'IA', 'Personal', 'Estudio'],
        instruction: `Based on the office state above, create the optimal day plan. Each slot can have MULTIPLE items. First call clear_day_session for each slot, then call set_day_session for each item. Rules:
1. If there are OVERDUE or RED priority items → prioritize their domain in morning slot
2. If Watch Later has 5+ items OR there are study-related inbox/tasks → assign Estudio to one slot
3. Mix domains — don't put the same domain in all 4 slots unless urgent
4. Each item MUST have a specific focus_text describing what to work on
5. 1-3 items per slot depending on workload
6. Link project_id when an item maps to a specific project
7. Study items from inbox/tasks: ${studyItems.map(i => i.text).join(', ') || 'none detected'}`,
    };
}

// ── Project Notes (mini-journal per project) ──────────

async function addProjectNote({ search_name, content }) {
    const { data: projects } = await supabase.from('projects').select('id, name')
        .ilike('name', `%${search_name}%`).limit(1);
    if (!projects?.length) return { error: `Project "${search_name}" not found` };

    const { error } = await supabase.from('project_notes')
        .insert({ project_id: projects[0].id, content });
    if (error) return { error: error.message };
    return { success: true, message: `Note added to project "${projects[0].name}": ${content.substring(0, 80)}...` };
}

async function getProjectNotes({ search_name, limit }) {
    const { data: projects } = await supabase.from('projects').select('id, name')
        .ilike('name', `%${search_name}%`).limit(1);
    if (!projects?.length) return { error: `Project "${search_name}" not found` };

    const { data: notes } = await supabase.from('project_notes')
        .select('*').eq('project_id', projects[0].id)
        .order('created_at', { ascending: false }).limit(limit || 10);

    if (!notes?.length) return { message: `No notes for project "${projects[0].name}" yet.` };
    return {
        project: projects[0].name,
        notes: notes.map(n => ({
            date: new Date(n.created_at).toISOString().split('T')[0],
            content: n.content,
        })),
    };
}

// Exported for Telegram bot usage
export { summarizeUrl };
