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
import { handleVoiceSocket } from './services/voicePipeline.js';
import { authMiddleware } from './middleware/auth.js';

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
});
