import { Router } from 'express';
import supabase from '../db/supabase.js';
const router = Router();

// Get sessions for a date (default today)
router.get('/', async (req, res) => {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
        .from('day_sessions')
        .select('*, projects(name)')
        .eq('date_key', date)
        .order('slot')
        .order('position');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Add a new item to a slot
router.post('/', async (req, res) => {
    const { date_key, slot, domain, project_id, focus_text } = req.body;
    const date = date_key || new Date().toISOString().split('T')[0];

    const { data: maxPos } = await supabase
        .from('day_sessions').select('position')
        .eq('date_key', date).eq('slot', slot)
        .order('position', { ascending: false }).limit(1).single();

    const row = { date_key: date, slot, domain, position: (maxPos?.position || 0) + 1 };
    if (project_id) row.project_id = project_id;
    if (focus_text) row.focus_text = focus_text;

    const { data, error } = await supabase
        .from('day_sessions').insert(row)
        .select('*, projects(name)').single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Clear all sessions for a slot on a date — MUST be before /:id
router.delete('/clear/:date/:slot', async (req, res) => {
    const { error } = await supabase.from('day_sessions').delete()
        .eq('date_key', req.params.date).eq('slot', req.params.slot);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ cleared: true });
});

// Clear all sessions for a date — MUST be before /:id
router.delete('/clear/:date', async (req, res) => {
    const { error } = await supabase.from('day_sessions').delete().eq('date_key', req.params.date);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ cleared: true });
});

// Update a session item
router.put('/:id', async (req, res) => {
    const update = {};
    const fields = ['slot', 'domain', 'project_id', 'focus_text', 'position', 'done'];
    fields.forEach(f => { if (req.body[f] !== undefined) update[f] = req.body[f]; });

    const { data, error } = await supabase
        .from('day_sessions').update(update)
        .eq('id', req.params.id)
        .select('*, projects(name)').single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Delete a session item
router.delete('/:id', async (req, res) => {
    const { error } = await supabase.from('day_sessions').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ deleted: true });
});

export default router;
