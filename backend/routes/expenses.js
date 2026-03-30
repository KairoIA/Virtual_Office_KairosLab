/**
 * Expenses REST API
 */

import { Router } from 'express';
import supabase from '../db/supabase.js';

const router = Router();

// Get expenses (with optional filters)
router.get('/', async (req, res) => {
    const { category, from, to } = req.query;
    let query = supabase.from('expenses').select('*').order('date_key', { ascending: false });

    if (category) query = query.ilike('category', `%${category}%`);
    if (from) query = query.gte('date_key', from);
    if (to) query = query.lte('date_key', to);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Add expense
router.post('/', async (req, res) => {
    const { concept, amount, category, date, notes } = req.body;
    if (!concept || amount === undefined) return res.status(400).json({ error: 'concept and amount required' });

    const { data, error } = await supabase
        .from('expenses')
        .insert({
            concept,
            amount: parseFloat(amount),
            category: category || 'General',
            date_key: date || new Date().toISOString().split('T')[0],
            notes: notes || '',
        })
        .select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Delete expense
router.delete('/:id', async (req, res) => {
    const { error } = await supabase.from('expenses').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ deleted: true });
});

export default router;
