/**
 * Daily Plan REST API (V4)
 * Up to 10 daily items with category, priority, energy
 */

import { Router } from 'express';
import supabase from '../db/supabase.js';

const router = Router();

router.get('/', async (req, res) => {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
        .from('daily_plan')
        .select('*')
        .eq('date_key', date)
        .order('slot');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.post('/', async (req, res) => {
    const { date, slot, text, category, project_id, energy, priority } = req.body;
    const dateKey = date || new Date().toISOString().split('T')[0];

    if (!slot || slot < 1 || slot > 10) return res.status(400).json({ error: 'slot must be 1-10' });
    if (!text) return res.status(400).json({ error: 'text required' });

    const row = { date_key: dateKey, slot, text, energy: energy || 'quick', done: false };
    if (category) row.category = category;
    if (project_id) row.project_id = project_id;
    if (priority) row.priority = priority;

    const { data, error } = await supabase
        .from('daily_plan')
        .upsert(row, { onConflict: 'date_key,slot' })
        .select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.put('/:id', async (req, res) => {
    const update = {};
    ['done', 'text', 'energy', 'category', 'priority'].forEach(f => {
        if (req.body[f] !== undefined) update[f] = req.body[f];
    });
    const { data, error } = await supabase
        .from('daily_plan').update(update)
        .eq('id', req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/:id', async (req, res) => {
    const { error } = await supabase.from('daily_plan').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ deleted: true });
});

export default router;
