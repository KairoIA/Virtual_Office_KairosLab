/**
 * Stats API — Aggregated analytics data
 */

import { Router } from 'express';
import supabase from '../db/supabase.js';

const router = Router();

router.get('/', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const todayDate = new Date(today);

        // Last 7 days
        const days7ago = new Date(todayDate.getTime() - 7 * 86400000).toISOString().split('T')[0];
        // Last 14 days (for comparison)
        const days14ago = new Date(todayDate.getTime() - 14 * 86400000).toISOString().split('T')[0];
        // Last 30 days
        const days30ago = new Date(todayDate.getTime() - 30 * 86400000).toISOString().split('T')[0];

        const [
            completedRes, completed14Res, sessionsRes, sessions14Res,
            tasksRes, projectsRes, completed30Res
        ] = await Promise.all([
            // This week completed
            supabase.from('completed').select('text, type, completed_date, category')
                .gte('completed_date', days7ago).order('completed_date'),
            // Previous week completed (for comparison)
            supabase.from('completed').select('completed_date')
                .gte('completed_date', days14ago).lt('completed_date', days7ago),
            // This week sessions
            supabase.from('day_sessions').select('slot, domain, done, date_key, focus_text, project_id')
                .gte('date_key', days7ago),
            // Previous week sessions
            supabase.from('day_sessions').select('done')
                .gte('date_key', days14ago).lt('date_key', days7ago),
            // All pending tasks
            supabase.from('tasks').select('category, project_id, deadline, created_at')
                .eq('done', false),
            // All projects
            supabase.from('projects').select('name, domain, status, project_type'),
            // Last 30 days completed (for daily trend)
            supabase.from('completed').select('completed_date')
                .gte('completed_date', days30ago).order('completed_date'),
        ]);

        const completed = completedRes.data || [];
        const completedPrev = completed14Res.data || [];
        const sessions = sessionsRes.data || [];
        const sessionsPrev = sessions14Res.data || [];
        const tasks = tasksRes.data || [];
        const projects = projectsRes.data || [];
        const completed30 = completed30Res.data || [];

        // === Completed by day (Mon-Sun of current week) ===
        const completedByDay = {};
        const dayOfWeek = todayDate.getDay(); // 0=Sun
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(todayDate.getTime() + mondayOffset * 86400000);
        for (let i = 0; i < 7; i++) {
            const d = new Date(monday.getTime() + i * 86400000).toISOString().split('T')[0];
            completedByDay[d] = 0;
        }
        completed.forEach(c => {
            if (completedByDay[c.completed_date] !== undefined) completedByDay[c.completed_date]++;
        });

        // === Completed by domain (from sessions done) ===
        const completedByDomain = {};
        sessions.filter(s => s.done).forEach(s => {
            completedByDomain[s.domain] = (completedByDomain[s.domain] || 0) + 1;
        });

        // === Day plan ratio ===
        const totalSessions = sessions.length;
        const doneSessions = sessions.filter(s => s.done).length;

        // === Comparison vs previous week ===
        const thisWeekCount = completed.length;
        const prevWeekCount = completedPrev.length;
        const weekDelta = prevWeekCount > 0
            ? Math.round(((thisWeekCount - prevWeekCount) / prevWeekCount) * 100)
            : (thisWeekCount > 0 ? 100 : 0);

        // === Sessions by slot ===
        const slotStats = {};
        ['morning', 'afternoon', 'evening', 'night'].forEach(slot => {
            const items = sessions.filter(s => s.slot === slot);
            slotStats[slot] = { total: items.length, done: items.filter(s => s.done).length };
        });

        // === Domains used this week ===
        const domainHours = {};
        const slotDurations = { morning: 3.5, afternoon: 3, evening: 2.5, night: 3.5 };
        sessions.filter(s => s.done).forEach(s => {
            const hours = slotDurations[s.slot] || 3;
            domainHours[s.domain] = (domainHours[s.domain] || 0) + hours;
        });

        // === Streak: consecutive days with completions (last 30 days) ===
        const completedDates = new Set(completed30.map(c => c.completed_date));
        let streak = 0;
        for (let i = 0; i < 30; i++) {
            const d = new Date(todayDate.getTime() - i * 86400000).toISOString().split('T')[0];
            if (completedDates.has(d)) streak++;
            else break;
        }

        // === Pending tasks by category ===
        const tasksByCategory = {};
        tasks.forEach(t => {
            const cat = t.category || 'General';
            tasksByCategory[cat] = (tasksByCategory[cat] || 0) + 1;
        });

        // === Projects summary ===
        const projectSummary = {
            active: projects.filter(p => p.status === 'active').length,
            paused: projects.filter(p => p.status === 'paused').length,
            blocked: projects.filter(p => p.status === 'blocked').length,
            done: projects.filter(p => p.status === 'done').length,
            permanent: projects.filter(p => p.project_type === 'permanent').length,
            temporal: projects.filter(p => p.project_type !== 'permanent').length,
        };

        res.json({
            completedByDay,
            completedByDomain,
            dayPlanRatio: { total: totalSessions, done: doneSessions },
            weekComparison: { thisWeek: thisWeekCount, prevWeek: prevWeekCount, delta: weekDelta },
            slotStats,
            domainHours,
            streak,
            tasksByCategory,
            projectSummary,
            pendingTasks: tasks.length,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
