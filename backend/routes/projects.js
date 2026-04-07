/**
 * Projects REST API
 * CRUD for project management
 */

import { Router } from 'express';
import supabase from '../db/supabase.js';

const router = Router();

// Get all projects (ordered by position)
router.get('/', async (req, res) => {
    const { data, error } = await supabase
        .from('projects')
        .select('id, name, domain, status, position, objective, notes, project_type, deadline, completed_at, created_at, updated_at')
        .order('position');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Get single project with its tasks and reminders
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    const [projectRes, tasksRes, remindersRes] = await Promise.all([
        supabase.from('projects').select('id, name, domain, status, position, objective, notes, project_type, deadline, completed_at, created_at, updated_at').eq('id', id).single(),
        supabase.from('tasks').select('id, text, done, position, deadline, category, priority, created_at').eq('project_id', id).order('position'),
        supabase.from('reminders').select('id, text, due_date, due_time, category, priority, position, done, created_at').eq('project_id', id).order('position'),
    ]);
    if (projectRes.error) return res.status(404).json({ error: 'Project not found' });
    res.json({
        ...projectRes.data,
        tasks: tasksRes.data || [],
        reminders: remindersRes.data || [],
    });
});

// Create project
router.post('/', async (req, res) => {
    const { name, domain, status, objective, notes, project_type } = req.body;
    const { data: maxPos } = await supabase
        .from('projects').select('position')
        .order('position', { ascending: false }).limit(1).single();

    const { data, error } = await supabase
        .from('projects')
        .insert({
            name,
            domain: domain || 'Personal',
            status: status || 'active',
            objective: objective || '',
            notes: notes || '',
            project_type: project_type || 'temporal',
            position: (maxPos?.position || 0) + 1,
        })
        .select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Update project
router.put('/:id', async (req, res) => {
    const update = {};
    const fields = ['name', 'domain', 'status', 'objective', 'notes', 'project_type', 'position', 'deadline', 'completed_at'];
    fields.forEach(f => { if (req.body[f] !== undefined) update[f] = req.body[f]; });

    const { data, error } = await supabase
        .from('projects')
        .update(update)
        .eq('id', req.params.id)
        .select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Delete project
router.delete('/:id', async (req, res) => {
    // Unlink tasks and reminders first
    await Promise.all([
        supabase.from('tasks').update({ project_id: null }).eq('project_id', req.params.id),
        supabase.from('reminders').update({ project_id: null }).eq('project_id', req.params.id),
    ]);
    const { error } = await supabase.from('projects').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ deleted: true });
});

export default router;
