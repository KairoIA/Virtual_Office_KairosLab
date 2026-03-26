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
 * Body: raw audio bytes
 * Content-Type: audio/webm, audio/mp4, audio/ogg, etc.
 */
router.post('/transcribe', async (req, res) => {
    try {
        const contentType = req.headers['content-type'] || 'audio/webm';
        const ext = contentType.includes('mp4') ? 'mp4'
                  : contentType.includes('ogg') ? 'ogg'
                  : contentType.includes('wav') ? 'wav'
                  : 'webm';

        console.log(`[STT] Received audio: ${contentType}, size: ${req.body?.length || 0} bytes, ext: ${ext}`);

        if (!req.body || req.body.length === 0) {
            return res.status(400).json({ error: 'No audio data received' });
        }

        const text = await transcribe(req.body, ext);
        console.log(`[STT] Transcribed: "${text}"`);
        res.json({ text });
    } catch (err) {
        console.error('[STT] Error:', err);
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

    try {
        const response = await processMessage(
            message,
            null,
            (name, args, result) => {
                functionsCalled.push({ name, args, result });
            }
        );

        res.json({ response, functions_called: functionsCalled });
    } catch (err) {
        console.error('[AI] Error:', err);
        res.status(500).json({ error: err.message });
    }
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
        console.error('[TTS] Error:', err);
        if (!res.headersSent) {
            res.status(500).json({ error: err.message });
        }
    }
});

export default router;
