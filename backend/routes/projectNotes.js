import { Router } from 'express';
import supabase from '../db/supabase.js';
const router = Router();

// Get notes for a project
router.get('/:projectId', async (req, res) => {
    const { data, error } = await supabase
        .from('project_notes')
        .select('id, project_id, content, created_at')
        .eq('project_id', req.params.projectId)
        .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Add note to project
router.post('/', async (req, res) => {
    const { project_id, content } = req.body;
    const { data, error } = await supabase
        .from('project_notes')
        .insert({ project_id, content })
        .select()
        .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Delete a note
router.delete('/:id', async (req, res) => {
    const { error } = await supabase.from('project_notes').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ deleted: true });
});

export default router;
