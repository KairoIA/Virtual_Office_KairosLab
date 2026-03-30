/**
 * Voice REST Endpoints
 * For non-WebSocket voice interactions (single request/response)
 */

import { Router } from 'express';
import { transcribe } from '../services/stt.js';
import { processMessage, getTokenUsage } from '../services/ai.js';
import { streamTTS } from '../services/tts.js';

const router = Router();

// ── API Error Classifier ────────────────────────────
function classifyApiError(service, err) {
    const msg = (err.message || '').toLowerCase();
    const status = err.status || err.statusCode || 0;

    // Insufficient funds / quota exceeded
    if (status === 402 || status === 429 || msg.includes('quota') || msg.includes('insufficient') || msg.includes('billing') || msg.includes('credit') || msg.includes('exceeded') || msg.includes('rate_limit')) {
        const links = {
            openai: 'platform.openai.com/account/billing',
            anthropic: 'console.anthropic.com/settings/billing',
            elevenlabs: 'elevenlabs.io/subscription',
        };
        return `Sin saldo en ${service.toUpperCase()}. Recarga en ${links[service] || service}`;
    }

    // Auth errors
    if (status === 401 || msg.includes('auth') || msg.includes('api_key') || msg.includes('invalid_api_key')) {
        return `API key inválida para ${service.toUpperCase()}. Revisa tu .env`;
    }

    // Generic
    return `Error en ${service.toUpperCase()}: ${err.message}`;
}

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
        const msg = classifyApiError('openai', err);
        res.status(500).json({ error: msg, api_error: true });
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
        const msg = classifyApiError('anthropic', err);
        res.status(500).json({ error: msg, api_error: true });
    }
});

/**
 * POST /api/voice/chat-stream
 * Body: { message: "text" }
 * Returns: SSE stream of tokens and function calls
 * Events: token, function, done
 */
router.post('/chat-stream', async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'message required' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
        await processMessage(
            message,
            (token) => {
                res.write(`data: ${JSON.stringify({ type: 'token', text: token })}\n\n`);
            },
            (name, args, result) => {
                res.write(`data: ${JSON.stringify({ type: 'function', name, args, result })}\n\n`);
            }
        );
        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    } catch (err) {
        const msg = classifyApiError('anthropic', err);
        res.write(`data: ${JSON.stringify({ type: 'error', message: msg, api_error: true })}\n\n`);
    }
    res.end();
});

/**
 * POST /api/voice/tts
 * Body: { text: "text to speak" }
 * Returns: audio/mpeg stream
 */
function cleanForTTS(t) {
    return t.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, '').replace(/\s{2,}/g, ' ').trim();
}

router.post('/tts', async (req, res) => {
    const text = cleanForTTS(req.body?.text || '');
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
            const msg = classifyApiError('elevenlabs', err);
            res.status(500).json({ error: msg, api_error: true });
        }
    }
});

// ── ConvAI signed URL endpoint ──────────────────────
router.get('/convai-token', async (req, res) => {
    const agentId = process.env.ELEVENLABS_AGENT_ID;
    if (!agentId) return res.status(500).json({ error: 'ELEVENLABS_AGENT_ID not configured' });

    try {
        const response = await fetch(
            `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`,
            { headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY } }
        );
        if (!response.ok) return res.status(500).json({ error: 'Failed to get signed URL' });
        const body = await response.json();
        res.json({ signedUrl: body.signed_url });
    } catch (err) {
        console.error('[CONVAI] Token error:', err.message);
        res.status(500).json({ error: 'Failed to get signed URL' });
    }
});

// ── Token usage endpoint ────────────────────────────
router.get('/usage', (req, res) => {
    res.json(getTokenUsage());
});

export default router;
