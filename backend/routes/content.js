import { Router } from 'express';
import supabase from '../db/supabase.js';
const router = Router();

router.get('/', async (req, res) => {
    const { topic, reviewed } = req.query;
    let query = supabase.from('saved_content').select('id, title, url, topic, source, notes, reviewed, reviewed_at, created_at').order('created_at', { ascending: false });
    if (topic) query = query.ilike('topic', `%${topic}%`);
    if (reviewed !== undefined) query = query.eq('reviewed', reviewed === 'true');
    const { data, error } = await query.limit(50);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.post('/', async (req, res) => {
    const { title, url, topic, source, notes } = req.body;
    const { data, error } = await supabase.from('saved_content')
        .insert({ title, url: url || '', topic: topic || 'General', source: source || '', notes: notes || '' })
        .select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.put('/:id', async (req, res) => {
    const update = {};
    ['title', 'url', 'topic', 'source', 'notes', 'reviewed'].forEach(f => {
        if (req.body[f] !== undefined) update[f] = req.body[f];
    });
    if (update.reviewed === true) update.reviewed_at = new Date().toISOString();
    const { data, error } = await supabase.from('saved_content').update(update).eq('id', req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/:id', async (req, res) => {
    const { error } = await supabase.from('saved_content').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ deleted: true });
});

export default router;
