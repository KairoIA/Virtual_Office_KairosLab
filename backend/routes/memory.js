import { Router } from 'express';
import supabase from '../db/supabase.js';
const router = Router();

router.get('/', async (req, res) => {
    const { category } = req.query;
    let query = supabase.from('kaira_memory').select('id, category, key, value, updated_at').order('updated_at', { ascending: false });
    if (category) query = query.eq('category', category);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.post('/', async (req, res) => {
    const { category, key, value } = req.body;
    const { data, error } = await supabase.from('kaira_memory')
        .upsert({ category: category || 'fact', key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
        .select('id, category, key, value, updated_at')
        .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/:id', async (req, res) => {
    const { error } = await supabase.from('kaira_memory').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ deleted: true });
});

export default router;
