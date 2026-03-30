/**
 * Voice Pipeline — Full Duplex
 * WebSocket handler: Mic audio → Whisper STT → GPT-4o-mini → ElevenLabs TTS → Speaker
 *
 * Protocol:
 *   Client → Server:
 *     { type: 'audio', data: base64_audio }     — voice input chunk
 *     { type: 'audio_end' }                      — end of voice input
 *     { type: 'text', message: string }           — text chat input
 *
 *   Server → Client:
 *     { type: 'transcript', text: string }        — STT result
 *     { type: 'token', text: string }             — LLM streaming token
 *     { type: 'audio', data: base64_audio }       — TTS audio chunk
 *     { type: 'function', name, args, result }    — function execution notification
 *     { type: 'done' }                            — response complete
 *     { type: 'error', message: string }          — error
 */

import { transcribe } from './stt.js';
import { processMessage } from './ai.js';
import { streamTTS } from './tts.js';

export function handleVoiceSocket(ws) {
    let audioChunks = [];

    ws.on('message', async (raw) => {
        try {
            const msg = JSON.parse(raw);

            switch (msg.type) {
                case 'audio':
                    // Accumulate audio chunks
                    audioChunks.push(Buffer.from(msg.data, 'base64'));
                    break;

                case 'audio_end':
                    // Process accumulated audio
                    if (audioChunks.length === 0) return;
                    const fullAudio = Buffer.concat(audioChunks);
                    audioChunks = [];

                    // STT
                    const transcript = await transcribe(fullAudio);
                    send(ws, { type: 'transcript', text: transcript });

                    // Process through AI + TTS
                    await processAndSpeak(ws, transcript);
                    break;

                case 'text':
                    // Direct text input (chat mode)
                    await processAndSpeak(ws, msg.message);
                    break;
            }
        } catch (err) {
            console.error('[Voice Pipeline] Error:', err);
            send(ws, { type: 'error', message: err.message });
        }
    });

    ws.on('close', () => {
        console.log('[WS] Voice client disconnected');
        audioChunks = [];
    });
}

async function processAndSpeak(ws, userText) {
    let fullResponse = '';
    let sentenceBuffer = '';
    const SENTENCE_ENDINGS = /[.!?;]\s*$/;

    const response = await processMessage(
        userText,
        // onToken — stream text + buffer for TTS
        (token) => {
            send(ws, { type: 'token', text: token });
            fullResponse += token;
            sentenceBuffer += token;

            // When we have a complete sentence, send to TTS (buffer more to reduce API calls)
            if (SENTENCE_ENDINGS.test(sentenceBuffer) && sentenceBuffer.trim().length > 80) {
                const textToSpeak = sentenceBuffer.trim();
                sentenceBuffer = '';
                speakChunk(ws, textToSpeak);
            }
        },
        // onFunctionCall
        (name, args, result) => {
            send(ws, { type: 'function', name, args, result });
        }
    );

    // Speak remaining buffered text
    if (sentenceBuffer.trim()) {
        await speakChunk(ws, sentenceBuffer.trim());
    }

    send(ws, { type: 'done' });
}

function cleanForTTS(text) {
    // Remove emojis and special symbols that cause TTS pauses
    return text
        .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

async function speakChunk(ws, text) {
    const clean = cleanForTTS(text);
    if (!clean) return;
    try {
        await streamTTS(clean, (audioChunk) => {
            send(ws, { type: 'audio', data: audioChunk.toString('base64') });
        });
    } catch (err) {
        console.error('[TTS] Error:', err.message);
    }
}

function send(ws, data) {
    if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(data));
    }
}
