import { Router } from 'express';
import supabase from '../db/supabase.js';
const router = Router();

router.get('/', async (req, res) => {
    const { category, project_id } = req.query;
    let query = supabase.from('notes').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false });
    if (category) query = query.eq('category', category);
    if (project_id) query = query.eq('project_id', project_id);
    const { data, error } = await query.limit(50);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.post('/', async (req, res) => {
    const { text, category, project_id, color, pinned } = req.body;
    const row = { text, category: category || 'General' };
    if (project_id) row.project_id = project_id;
    if (color) row.color = color;
    if (pinned) row.pinned = pinned;
    const { data, error } = await supabase.from('notes').insert(row).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/:id', async (req, res) => {
    const { error } = await supabase.from('notes').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ deleted: true });
});

export default router;
