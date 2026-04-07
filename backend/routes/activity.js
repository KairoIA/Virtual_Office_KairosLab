import { Router } from 'express';
import supabase from '../db/supabase.js';
const router = Router();

router.get('/', async (req, res) => {
    const { category, from, to } = req.query;
    let query = supabase.from('activity_log').select('id, activity, category, date_key, notes').order('date_key', { ascending: false });
    if (category) query = query.ilike('category', `%${category}%`);
    if (from) query = query.gte('date_key', from);
    if (to) query = query.lte('date_key', to);
    const { data, error } = await query.limit(100);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.post('/', async (req, res) => {
    const { activity, category, date, notes } = req.body;
    const { data, error } = await supabase.from('activity_log')
        .insert({ activity, category: category || 'General', date_key: date || new Date().toISOString().split('T')[0], notes: notes || '' })
        .select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/:id', async (req, res) => {
    const { error } = await supabase.from('activity_log').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ deleted: true });
});

export default router;
