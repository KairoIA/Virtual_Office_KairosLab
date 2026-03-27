/**
 * KAIROS Assistant Module
 * Chat + Voice interface — REST only (reliable through Cloudflare Tunnel)
 */

const API_BASE = window.KAIROS_API_URL || 'https://www.kairoslaboffice.trade';

// Callback to refresh UI after Kaira modifies data
let onDataChanged = null;
export function setOnDataChanged(fn) { onDataChanged = fn; }

let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let voiceMode = false;
let recordingStream = null;
let recordingMime = 'audio/webm';

// ── Init ─────────────────────────────────────────────
export function connectVoice() {
    // No WebSocket — using REST only for reliability
    updateStatus('connected');
}

// ── Text Chat ────────────────────────────────────────
export function sendTextMessage(text) {
    if (!text.trim()) return;
    voiceMode = false;
    appendChat('user', text);
    sendToAI(text);
}

async function sendToAI(text) {
    if (voiceMode) {
        // Streaming mode — tokens appear as Kaira speaks
        await sendToAIStreaming(text);
    } else {
        // Simple REST for text chat
        try {
            const res = await fetch(`${API_BASE}/api/voice/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text }),
            });
            const data = await res.json();
            appendChat('assistant', data.response);
            if (data.functions_called?.length) {
                data.functions_called.forEach(fc => showFunctionCall(fc.name, fc.result));
                if (onDataChanged) onDataChanged();
            }
        } catch (err) {
            appendChat('system', `Error de conexion: ${err.message}`);
        }
    }
}

async function sendToAIStreaming(text) {
    try {
        const res = await fetch(`${API_BASE}/api/voice/chat-stream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text }),
        });

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let sentenceBuffer = '';
        let sentences = []; // Collect sentences with their text
        const SENTENCE_END = /[.!?;]\s*$/;

        // Phase 1: Collect all tokens, buffer sentences, start TTS fetching early
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const json = line.slice(6);
                if (!json) continue;

                try {
                    const msg = JSON.parse(json);

                    if (msg.type === 'token') {
                        sentenceBuffer += msg.text;

                        if (SENTENCE_END.test(sentenceBuffer) && sentenceBuffer.trim().length > 10) {
                            const sentence = sentenceBuffer.trim();
                            sentenceBuffer = '';
                            // Start fetching TTS immediately (don't wait)
                            const audioPromise = fetchTTSAudio(sentence);
                            sentences.push({ text: sentence, audioPromise });
                        }
                    } else if (msg.type === 'function') {
                        showFunctionCall(msg.name, msg.result);
                        if (onDataChanged) onDataChanged();
                    } else if (msg.type === 'done') {
                        if (sentenceBuffer.trim()) {
                            const sentence = sentenceBuffer.trim();
                            const audioPromise = fetchTTSAudio(sentence);
                            sentences.push({ text: sentence, audioPromise });
                            sentenceBuffer = '';
                        }
                    }
                } catch {}
            }
        }

        // Phase 2: Play each sentence — typewriter text + audio simultaneously
        for (const s of sentences) {
            const audioUrl = await s.audioPromise;
            if (audioUrl) {
                // Play audio and typewriter text at the same time
                await playSentenceWithText(s.text, audioUrl);
            } else {
                // No audio, just show text
                await typewriterText(s.text);
            }
        }

        finalizeResponse();
    } catch (err) {
        appendChat('system', `Error de conexion: ${err.message}`);
    }
}

async function fetchTTSAudio(text) {
    try {
        const res = await fetch(`${API_BASE}/api/voice/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
        });
        if (!res.ok) return null;
        const blob = await res.blob();
        return URL.createObjectURL(blob);
    } catch {
        return null;
    }
}

function playSentenceWithText(text, audioUrl) {
    return new Promise((resolve) => {
        const audio = new Audio(audioUrl);

        // Start typewriter when audio starts playing
        audio.onplay = () => {
            const duration = audio.duration || 3;
            const msPerChar = (duration * 1000) / text.length;
            typewriterText(text, msPerChar);
        };

        audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            resolve();
        };
        audio.onerror = () => {
            URL.revokeObjectURL(audioUrl);
            typewriterText(text).then(resolve);
        };
        audio.play().catch(() => {
            typewriterText(text).then(resolve);
        });
    });
}

function typewriterText(text, msPerChar = 30) {
    return new Promise((resolve) => {
        let i = 0;
        const interval = setInterval(() => {
            if (i < text.length) {
                appendToken(text[i]);
                i++;
            } else {
                clearInterval(interval);
                resolve();
            }
        }, msPerChar);
    });
}

// ── Voice Recording ──────────────────────────────────
function detectMimeType() {
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
    for (const t of types) {
        if (MediaRecorder.isTypeSupported(t)) return t;
    }
    return '';
}

export async function toggleRecording() {
    if (isRecording) {
        stopRecording();
    } else {
        await startRecording();
    }
}

async function startRecording() {
    try {
        recordingMime = detectMimeType();
        if (!recordingMime) {
            appendChat('system', 'Tu navegador no soporta grabacion de audio');
            return;
        }

        recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(recordingStream, { mimeType: recordingMime });
        audioChunks = [];

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) audioChunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
            recordingStream.getTracks().forEach(t => t.stop());
            processRecordedAudio();
        };

        mediaRecorder.onerror = (e) => {
            appendChat('system', `Error de grabacion: ${e.error?.message || 'desconocido'}`);
            recordingStream.getTracks().forEach(t => t.stop());
            isRecording = false;
            updateMicButton(false);
        };

        mediaRecorder.start(500);
        isRecording = true;
        voiceMode = true;
        updateMicButton(true);
    } catch (err) {
        appendChat('system', `Micro no disponible: ${err.message}`);
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
    isRecording = false;
    updateMicButton(false);
}

async function processRecordedAudio() {
    const blob = new Blob(audioChunks, { type: recordingMime });

    if (blob.size < 1000) {
        appendChat('system', 'Audio demasiado corto, intenta de nuevo');
        return;
    }

    appendChat('system', 'Transcribiendo...');

    try {
        const res = await fetch(`${API_BASE}/api/voice/transcribe`, {
            method: 'POST',
            body: blob,
            headers: { 'Content-Type': recordingMime },
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP ${res.status}`);
        }

        const { text } = await res.json();
        removeSystemMessages('Transcribiendo');

        if (!text || !text.trim()) {
            appendChat('system', 'No se detecto voz, intenta de nuevo');
            return;
        }

        appendChat('user', text);
        await sendToAI(text);
    } catch (err) {
        removeSystemMessages('Transcribiendo');
        appendChat('system', `Error: ${err.message}`);
    }
}

// ── Speak via TTS (sequential queue) ─────────────────
let ttsPlaying = false;
let ttsPendingQueue = [];

async function speakText(text) {
    if (!text || !text.trim()) return;
    try {
        const res = await fetch(`${API_BASE}/api/voice/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
        });
        if (!res.ok) return;
        const audioBlob = await res.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        ttsPendingQueue.push(audioUrl);
        if (!ttsPlaying) playTTSQueue();
    } catch (err) {
        console.error('[TTS] Error:', err.message);
    }
}

function playTTSQueue() {
    if (ttsPendingQueue.length === 0) {
        ttsPlaying = false;
        return;
    }
    ttsPlaying = true;
    const url = ttsPendingQueue.shift();
    const audio = new Audio(url);
    audio.onended = () => { URL.revokeObjectURL(url); playTTSQueue(); };
    audio.onerror = () => { URL.revokeObjectURL(url); playTTSQueue(); };
    audio.play().catch(() => playTTSQueue());
}

// ── UI Helpers ───────────────────────────────────────
let currentAssistantMsg = null;

function appendChat(role, text) {
    const chatLog = document.getElementById('chatLog');
    if (!chatLog) return;

    const div = document.createElement('div');
    div.className = `chat-msg chat-${role}`;
    const label = role === 'user' ? 'Tu' : role === 'assistant' ? 'Kaira' : 'Sistema';
    div.innerHTML = `<span class="chat-role">${label}:</span> ${text}`;
    chatLog.appendChild(div);
    chatLog.scrollTop = chatLog.scrollHeight;
}

function appendToken(token) {
    const chatLog = document.getElementById('chatLog');
    if (!chatLog) return;

    if (!currentAssistantMsg) {
        currentAssistantMsg = document.createElement('div');
        currentAssistantMsg.className = 'chat-msg chat-assistant';
        currentAssistantMsg.innerHTML = '<span class="chat-role">Kaira:</span> ';
        chatLog.appendChild(currentAssistantMsg);
    }

    currentAssistantMsg.innerHTML += token;
    chatLog.scrollTop = chatLog.scrollHeight;
}

function finalizeResponse() {
    currentAssistantMsg = null;
}

function showFunctionCall(name, result) {
    const chatLog = document.getElementById('chatLog');
    if (!chatLog) return;

    const div = document.createElement('div');
    div.className = 'chat-msg chat-function';
    const icon = result?.success ? '\u2705' : '\u274C';
    div.innerHTML = `<span class="chat-fn-badge">${icon} ${name}</span> ${result?.message || JSON.stringify(result)}`;
    chatLog.appendChild(div);
    chatLog.scrollTop = chatLog.scrollHeight;
}

function removeSystemMessages(containing) {
    const chatLog = document.getElementById('chatLog');
    if (!chatLog) return;
    chatLog.querySelectorAll('.chat-system').forEach(m => {
        if (m.textContent.includes(containing)) m.remove();
    });
}

function updateStatus(status) {
    const indicator = document.getElementById('voiceStatus');
    if (indicator) {
        indicator.className = `voice-status ${status}`;
        indicator.title = status === 'connected' ? 'Kaira conectada' : 'Desconectada';
    }
}

function updateMicButton(recording) {
    const btn = document.getElementById('micButton');
    if (btn) {
        btn.classList.toggle('recording', recording);
        btn.title = recording ? 'Detener grabacion' : 'Hablar con Kaira';
    }
}
