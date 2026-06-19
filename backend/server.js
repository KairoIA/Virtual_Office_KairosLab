/**
 * KAIROS LAB — Backend Server
 * Express REST API + WebSocket for voice pipeline
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import http from 'http';

import apiRouter from './routes/api.js';
import voiceRouter from './routes/voice.js';
import projectsRouter from './routes/projects.js';
import inboxRouter from './routes/inbox.js';
import top3Router from './routes/top3.js';
import expensesRouter from './routes/expenses.js';
import memoryRouter from './routes/memory.js';
import listsRouter from './routes/lists.js';
import activityRouter from './routes/activity.js';
import contentRouter from './routes/content.js';
import notesRouter from './routes/notes.js';
import daySessionsRouter from './routes/daySessions.js';
import projectNotesRouter from './routes/projectNotes.js';
import statsRouter from './routes/stats.js';
import { handleVoiceSocket } from './services/voicePipeline.js';
import { authMiddleware, getAuthStats } from './middleware/auth.js';
import { startTelegramBot } from './services/telegram.js';
import { startRecurringCron } from './services/recurringCron.js';
import { startMorningBriefing } from './services/morningBriefing.js';
import { startWeeklyReview, startMonthlyReview } from './services/weeklyReview.js';
import { startReminderAlerts } from './services/reminderAlerts.js';
import { startMidnightCron } from './services/midnightCron.js';
import { startNightlyJournal } from './services/nightlyJournal.js';
import { startKeepAlive } from './services/keepAlive.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const server = http.createServer(app);

// ── Middleware ────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.raw({ type: 'audio/*', limit: '25mb' }));

// ── API request counter (egress debug) ──────────────
const apiHits = {};
function trackRequest(req, res, next) {
    const path = req.baseUrl + (req.path === '/' ? '' : req.path);
    apiHits[path] = (apiHits[path] || 0) + 1;
    next();
}

// ── Health check ─────────────────────────────────────
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'kairos-backend', timestamp: new Date().toISOString(), auth: getAuthStats() });
});

app.get('/api/egress-debug', authMiddleware, async (req, res) => {
    const { getQueryStats } = await import('./db/supabase.js');
    const sorted = Object.entries(apiHits).sort((a, b) => b[1] - a[1]);
    const uptime = Math.round(process.uptime() / 60);
    res.json({
        api_hits: { uptime_min: uptime, total: sorted.reduce((s, e) => s + e[1], 0), endpoints: Object.fromEntries(sorted) },
        supabase_queries: getQueryStats(),
    });
});

// ── REST Routes ──────────────────────────────────────
app.use('/api', authMiddleware, trackRequest, apiRouter);
app.use('/api/voice', authMiddleware, trackRequest, voiceRouter);
app.use('/api/projects', authMiddleware, trackRequest, projectsRouter);
app.use('/api/inbox', authMiddleware, trackRequest, inboxRouter);
app.use('/api/top3', authMiddleware, trackRequest, top3Router);
app.use('/api/expenses', authMiddleware, trackRequest, expensesRouter);
app.use('/api/memory', authMiddleware, trackRequest, memoryRouter);
app.use('/api/lists', authMiddleware, trackRequest, listsRouter);
app.use('/api/activity', authMiddleware, trackRequest, activityRouter);
app.use('/api/content', authMiddleware, trackRequest, contentRouter);
app.use('/api/notes', authMiddleware, trackRequest, notesRouter);
app.use('/api/day-sessions', authMiddleware, trackRequest, daySessionsRouter);
app.use('/api/project-notes', authMiddleware, trackRequest, projectNotesRouter);
app.use('/api/stats', authMiddleware, trackRequest, statsRouter);

// ── Serve frontend static files ─────────────────────
const frontendDir = path.join(__dirname, '..');
app.use(express.static(frontendDir, { extensions: ['html'], maxAge: 0, etag: false }));

// ── WebSocket for real-time voice ────────────────────
const wss = new WebSocketServer({ server, path: '/ws/voice' });
wss.on('connection', (ws) => {
    console.log('[WS] Voice client connected');
    handleVoiceSocket(ws);
});

// ── Start ────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`[KAIROS] Server running on port ${PORT}`);
    console.log(`[KAIROS] REST API: http://localhost:${PORT}/api`);
    console.log(`[KAIROS] Voice WS: ws://localhost:${PORT}/ws/voice`);
    startTelegramBot();
    startRecurringCron();
    startMorningBriefing();
    startWeeklyReview();
    startMonthlyReview();
    startReminderAlerts();
    startMidnightCron();
    startNightlyJournal();
    startKeepAlive();
});
