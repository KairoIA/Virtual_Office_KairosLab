import { Router } from 'express';
import supabase from '../db/supabase.js';
const router = Router();

router.get('/', async (req, res) => {
    const { category } = req.query;
    let query = supabase.from('kaira_memory').select('*').order('updated_at', { ascending: false });
    if (category) query = query.eq('category', category);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.post('/', async (req, res) => {
    const { category, key, value } = req.body;
    // Upsert by key
    const { data: existing } = await supabase.from('kaira_memory').select('id').eq('key', key).limit(1);
    let result;
    if (existing?.length) {
        result = await supabase.from('kaira_memory').update({ value, category }).eq('id', existing[0].id).select().single();
    } else {
        result = await supabase.from('kaira_memory').insert({ category: category || 'fact', key, value }).select().single();
    }
    if (result.error) return res.status(500).json({ error: result.error.message });
    res.json(result.data);
});

router.delete('/:id', async (req, res) => {
    const { error } = await supabase.from('kaira_memory').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ deleted: true });
});

export default router;
