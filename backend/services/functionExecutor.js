/**
 * Function Executor
 * Executes AI function calls against Supabase
 */

import supabase from '../db/supabase.js';

export async function executeFunction(name, args) {
    switch (name) {
        case 'add_reminder':
            return addReminder(args);
        case 'add_task':
            return addTask(args);
        case 'complete_item':
            return completeItem(args);
        case 'delete_item':
            return deleteItem(args);
        case 'write_journal':
            return writeJournal(args);
        case 'get_agenda':
            return getAgenda(args);
        case 'search_entries':
            return searchEntries(args);
        default:
            return { error: `Unknown function: ${name}` };
    }
}

async function addReminder({ text, due_date }) {
    const { data: maxPos } = await supabase
        .from('reminders').select('position')
        .order('position', { ascending: false }).limit(1).single();

    const { data, error } = await supabase
        .from('reminders')
        .insert({ text, due_date: due_date || null, position: (maxPos?.position || 0) + 1 })
        .select().single();

    if (error) return { error: error.message };
    return { success: true, message: `Reminder added: "${text}"${due_date ? ` for ${due_date}` : ''}` };
}

async function addTask({ text }) {
    const { data: maxPos } = await supabase
        .from('tasks').select('position')
        .order('position', { ascending: false }).limit(1).single();

    const { data, error } = await supabase
        .from('tasks')
        .insert({ text, position: (maxPos?.position || 0) + 1 })
        .select().single();

    if (error) return { error: error.message };
    return { success: true, message: `Task added: "${text}"` };
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

async function writeJournal({ date, content, append }) {
    const { data: existing } = await supabase
        .from('journal').select('content')
        .eq('date_key', date).single();

    const finalContent = append && existing?.content
        ? existing.content + '<br>' + content
        : content;

    const { error } = await supabase
        .from('journal')
        .upsert({ date_key: date, content: finalContent }, { onConflict: 'date_key' });

    if (error) return { error: error.message };
    return { success: true, message: `Journal ${append ? 'updated' : 'written'} for ${date}` };
}

async function getAgenda({ date }) {
    const today = date || new Date().toISOString().split('T')[0];

    const [journalRes, remindersRes, tasksRes] = await Promise.all([
        supabase.from('journal').select('content').eq('date_key', today).single(),
        supabase.from('reminders').select('*').eq('done', false).order('position'),
        supabase.from('tasks').select('*').eq('done', false).order('position'),
    ]);

    const todayReminders = (remindersRes.data || []).filter(r => r.due_date === today);
    const overdueReminders = (remindersRes.data || []).filter(r => r.due_date && r.due_date < today);

    return {
        date: today,
        journal: journalRes.data?.content || '(empty)',
        today_deadlines: todayReminders.map(r => r.text),
        overdue: overdueReminders.map(r => `${r.text} (was due ${r.due_date})`),
        all_reminders: (remindersRes.data || []).map(r => `${r.text}${r.due_date ? ` [${r.due_date}]` : ''}`),
        all_tasks: (tasksRes.data || []).map(t => t.text),
    };
}

async function searchEntries({ query }) {
    const q = `%${query}%`;

    const [journalRes, remindersRes, tasksRes] = await Promise.all([
        supabase.from('journal').select('date_key, content').ilike('content', q).limit(10),
        supabase.from('reminders').select('text, due_date').ilike('text', q).limit(10),
        supabase.from('tasks').select('text').ilike('text', q).limit(10),
    ]);

    return {
        journal: (journalRes.data || []).map(j => ({ date: j.date_key, preview: j.content.substring(0, 200) })),
        reminders: remindersRes.data || [],
        tasks: tasksRes.data || [],
    };
}
