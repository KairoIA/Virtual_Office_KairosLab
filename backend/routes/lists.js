import { Router } from 'express';
import supabase from '../db/supabase.js';
const router = Router();

router.get('/', async (req, res) => {
    const { data, error } = await supabase.from('lists').select('id, name, created_at, list_items(id, list_id, text, done, position)').order('created_at');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.post('/', async (req, res) => {
    const { name } = req.body;
    const { data, error } = await supabase.from('lists').insert({ name }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.post('/:id/items', async (req, res) => {
    const { text } = req.body;
    const { data: maxPos } = await supabase.from('list_items').select('position')
        .eq('list_id', req.params.id).order('position', { ascending: false }).limit(1).single();
    const { data, error } = await supabase.from('list_items')
        .insert({ list_id: req.params.id, text, position: (maxPos?.position || 0) + 1 }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.put('/items/:itemId', async (req, res) => {
    const { done, text } = req.body;
    const update = {};
    if (done !== undefined) update.done = done;
    if (text !== undefined) update.text = text;
    const { data, error } = await supabase.from('list_items').update(update).eq('id', req.params.itemId).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/items/:itemId', async (req, res) => {
    const { error } = await supabase.from('list_items').delete().eq('id', req.params.itemId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ deleted: true });
});

router.delete('/:id', async (req, res) => {
    const { error } = await supabase.from('lists').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ deleted: true });
});

export default router;
