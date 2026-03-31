/**
 * KAIROS REST API
 * CRUD for journal, reminders, tasks, completed
 */

import { Router } from 'express';
import supabase from '../db/supabase.js';

const router = Router();

// ═══════════════════════════════════════════════════════
// JOURNAL
// ═══════════════════════════════════════════════════════

router.get('/journal', async (req, res) => {
    const { data, error } = await supabase
        .from('journal')
        .select('date_key, content');
    if (error) return res.status(500).json({ error: error.message });

    // Return as { "2026-03-26": "<html>", ... } for frontend compat
    const map = {};
    data.forEach(row => { map[row.date_key] = row.content; });
    res.json(map);
});

router.get('/journal/:dateKey', async (req, res) => {
    const { data, error } = await supabase
        .from('journal')
        .select('content')
        .eq('date_key', req.params.dateKey)
        .single();
    if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });
    res.json({ content: data?.content || '' });
});

router.put('/journal/:dateKey', async (req, res) => {
    const { dateKey } = req.params;
    const { content } = req.body;

    if (!content || content === '<br>') {
        await supabase.from('journal').delete().eq('date_key', dateKey);
        return res.json({ deleted: true });
    }

    const { error } = await supabase
        .from('journal')
        .upsert({ date_key: dateKey, content }, { onConflict: 'date_key' });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ saved: true });
});

// ═══════════════════════════════════════════════════════
// REMINDERS
// ═══════════════════════════════════════════════════════

router.get('/reminders', async (req, res) => {
    const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .order('position');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.post('/reminders', async (req, res) => {
    const { text, due_date, due_time, category, priority, project_id } = req.body;
    const { data: maxPos } = await supabase
        .from('reminders')
        .select('position')
        .order('position', { ascending: false })
        .limit(1)
        .single();
    const position = (maxPos?.position || 0) + 1;

    const row = { text, due_date: due_date || null, position };
    if (due_time) row.due_time = due_time;
    if (category) row.category = category;
    if (priority) row.priority = priority;
    if (project_id) row.project_id = project_id;

    const { data, error } = await supabase
        .from('reminders')
        .insert(row)
        .select()
        .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.put('/reminders/:id', async (req, res) => {
    const { text, done, position, due_time, category, priority } = req.body;
    const update = {};
    if (text !== undefined) update.text = text;
    if (done !== undefined) update.done = done;
    if (position !== undefined) update.position = position;
    if (due_time !== undefined) update.due_time = due_time || null;
    if (category !== undefined) update.category = category;
    if (priority !== undefined) update.priority = priority;

    const { data, error } = await supabase
        .from('reminders')
        .update(update)
        .eq('id', req.params.id)
        .select()
        .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/reminders/:id', async (req, res) => {
    const { error } = await supabase.from('reminders').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ deleted: true });
});

// ═══════════════════════════════════════════════════════
// TASKS
// ═══════════════════════════════════════════════════════

router.get('/tasks', async (req, res) => {
    const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('position');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.post('/tasks', async (req, res) => {
    const { text, project_id, deadline, category, priority } = req.body;
    const { data: maxPos } = await supabase
        .from('tasks')
        .select('position')
        .order('position', { ascending: false })
        .limit(1)
        .single();
    const position = (maxPos?.position || 0) + 1;

    const row = { text, position };
    if (project_id) row.project_id = project_id;
    if (deadline) row.deadline = deadline;
    if (category) row.category = category;
    if (priority) row.priority = priority;

    const { data, error } = await supabase
        .from('tasks')
        .insert(row)
        .select()
        .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.put('/tasks/:id', async (req, res) => {
    const { text, done, position, deadline, category, priority } = req.body;
    const update = {};
    if (text !== undefined) update.text = text;
    if (done !== undefined) update.done = done;
    if (position !== undefined) update.position = position;
    if (deadline !== undefined) update.deadline = deadline;
    if (category !== undefined) update.category = category;
    if (priority !== undefined) update.priority = priority;

    const { data, error } = await supabase
        .from('tasks')
        .update(update)
        .eq('id', req.params.id)
        .select()
        .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/tasks/:id', async (req, res) => {
    const { error } = await supabase.from('tasks').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ deleted: true });
});

// ═══════════════════════════════════════════════════════
// COMPLETED HISTORY
// ═══════════════════════════════════════════════════════

router.get('/completed', async (req, res) => {
    const { data, error } = await supabase
        .from('completed')
        .select('*')
        .order('completed_date', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.post('/completed', async (req, res) => {
    const { text, type, duration } = req.body;
    const { data, error } = await supabase
        .from('completed')
        .insert({ text, type, duration: duration || '' })
        .select()
        .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/completed/:id', async (req, res) => {
    const { error } = await supabase.from('completed').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ deleted: true });
});

// ═══════════════════════════════════════════════════════
// BULK EXPORT / IMPORT (migration from localStorage)
// ═══════════════════════════════════════════════════════

router.post('/import', async (req, res) => {
    const { journal, reminders, tasks, completed } = req.body;
    const errors = [];

    if (journal) {
        for (const [dateKey, content] of Object.entries(journal)) {
            const { error } = await supabase
                .from('journal')
                .upsert({ date_key: dateKey, content }, { onConflict: 'date_key' });
            if (error) errors.push(`journal ${dateKey}: ${error.message}`);
        }
    }

    if (reminders?.length) {
        const rows = reminders.map((r, i) => ({
            text: r.text,
            due_date: r.dueDate || null,
            done: r.done || false,
            position: i,
        }));
        const { error } = await supabase.from('reminders').insert(rows);
        if (error) errors.push(`reminders: ${error.message}`);
    }

    if (tasks?.length) {
        const rows = tasks.map((t, i) => ({
            text: t.text,
            done: t.done || false,
            position: i,
            created_at: t.createdAt || new Date().toISOString(),
        }));
        const { error } = await supabase.from('tasks').insert(rows);
        if (error) errors.push(`tasks: ${error.message}`);
    }

    if (completed?.length) {
        const rows = completed.map(c => ({
            text: c.text,
            completed_date: c.date,
            type: c.type,
            duration: c.duration || '',
        }));
        const { error } = await supabase.from('completed').insert(rows);
        if (error) errors.push(`completed: ${error.message}`);
    }

    if (errors.length) return res.status(207).json({ partial: true, errors });
    res.json({ imported: true });
});

export default router;
