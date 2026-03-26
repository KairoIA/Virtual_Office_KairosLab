/**
 * Voice REST Endpoints
 * For non-WebSocket voice interactions (single request/response)
 */

import { Router } from 'express';
import { transcribe } from '../services/stt.js';
import { processMessage } from '../services/ai.js';
import { streamTTS } from '../services/tts.js';

const router = Router();

/**
 * POST /api/voice/transcribe
 * Body: raw audio (multipart/form-data with field "audio")
 */
router.post('/transcribe', async (req, res) => {
    try {
        if (!req.body || !Buffer.isBuffer(req.body)) {
            return res.status(400).json({ error: 'Send raw audio in body' });
        }
        const text = await transcribe(req.body);
        res.json({ text });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/voice/chat
 * Body: { message: "text" }
 * Returns: { response: "text", functions_called: [...] }
 */
router.post('/chat', async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'message required' });

    const functionsCalled = [];

    const response = await processMessage(
        message,
        null, // no streaming for REST
        (name, args, result) => {
            functionsCalled.push({ name, args, result });
        }
    );

    res.json({ response, functions_called: functionsCalled });
});

/**
 * POST /api/voice/tts
 * Body: { text: "text to speak" }
 * Returns: audio/mpeg stream
 */
router.post('/tts', async (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'text required' });

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Transfer-Encoding', 'chunked');

    try {
        await streamTTS(text, (chunk) => {
            res.write(chunk);
        }, () => {
            res.end();
        });
    } catch (err) {
        if (!res.headersSent) {
            res.status(500).json({ error: err.message });
        }
    }
});

export default router;
