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
import { authMiddleware } from './middleware/auth.js';
import { startTelegramBot } from './services/telegram.js';
import { startRecurringCron } from './services/recurringCron.js';
import { startMorningBriefing } from './services/morningBriefing.js';
import { startWeeklyReview, startMonthlyReview } from './services/weeklyReview.js';
import { startReminderAlerts } from './services/reminderAlerts.js';
import { startMidnightCron } from './services/midnightCron.js';
import { startNightlyJournal } from './services/nightlyJournal.js';

const app = express();
const server = http.createServer(app);

// ── Middleware ────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.raw({ type: 'audio/*', limit: '25mb' }));

// ── Health check ─────────────────────────────────────
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'kairos-backend', timestamp: new Date().toISOString() });
});

// ── REST Routes ──────────────────────────────────────
app.use('/api', authMiddleware, apiRouter);
app.use('/api/voice', authMiddleware, voiceRouter);
app.use('/api/projects', authMiddleware, projectsRouter);
app.use('/api/inbox', authMiddleware, inboxRouter);
app.use('/api/top3', authMiddleware, top3Router);
app.use('/api/expenses', authMiddleware, expensesRouter);
app.use('/api/memory', authMiddleware, memoryRouter);
app.use('/api/lists', authMiddleware, listsRouter);
app.use('/api/activity', authMiddleware, activityRouter);
app.use('/api/content', authMiddleware, contentRouter);
app.use('/api/notes', authMiddleware, notesRouter);
app.use('/api/day-sessions', authMiddleware, daySessionsRouter);
app.use('/api/project-notes', authMiddleware, projectNotesRouter);
app.use('/api/stats', authMiddleware, statsRouter);

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
});
