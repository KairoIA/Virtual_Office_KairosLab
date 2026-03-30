/**
 * Inbox REST API
 * Quick capture for unprocessed items
 */

import { Router } from 'express';
import supabase from '../db/supabase.js';

const router = Router();

// Get all inbox items (unprocessed first)
router.get('/', async (req, res) => {
    const { data, error } = await supabase
        .from('inbox')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Add to inbox
router.post('/', async (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'text required' });

    const { data, error } = await supabase
        .from('inbox')
        .insert({ text })
        .select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Mark as processed
router.put('/:id', async (req, res) => {
    const { processed } = req.body;
    const update = { processed: processed !== undefined ? processed : true };
    if (update.processed) update.processed_at = new Date().toISOString();
    const { data, error } = await supabase
        .from('inbox')
        .update(update)
        .eq('id', req.params.id)
        .select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Delete inbox item
router.delete('/:id', async (req, res) => {
    const { error } = await supabase.from('inbox').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ deleted: true });
});

export default router;
