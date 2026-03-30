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
let activeRecordingButton = null; // 'voice' or 'text'

// ── Init ─────────────────────────────────────────────
export function connectVoice() {
    // No WebSocket — using REST only for reliability
    // Set connected immediately and also after delay to catch late DOM
    updateStatus('connected');
    setTimeout(() => updateStatus('connected'), 500);
    setTimeout(() => updateStatus('connected'), 2000);
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
            if (data.api_error) {
                appendChat('system', `\u26A0\uFE0F ${data.error}`);
            } else {
                appendChat('assistant', data.response);
                if (data.functions_called?.length) {
                    data.functions_called.forEach(fc => showFunctionCall(fc.name, fc.result));
                    if (onDataChanged) onDataChanged();
                }
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

        // Phase 1: Collect all tokens and split into sentences
        let sentenceTexts = [];
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
                            sentenceTexts.push(sentenceBuffer.trim());
                            sentenceBuffer = '';
                        }
                    } else if (msg.type === 'function') {
                        showFunctionCall(msg.name, msg.result);
                        if (onDataChanged) onDataChanged();
                    } else if (msg.type === 'done') {
                        if (sentenceBuffer.trim()) {
                            sentenceTexts.push(sentenceBuffer.trim());
                            sentenceBuffer = '';
                        }
                    }
                } catch {}
            }
        }

        // Flush remaining
        if (sentenceBuffer.trim()) {
            sentenceTexts.push(sentenceBuffer.trim());
            sentenceBuffer = '';
        }

        // Phase 2: Launch TTS with context (previous_text + next_text) for natural prosody
        for (let i = 0; i < sentenceTexts.length; i++) {
            const previous_text = i > 0 ? sentenceTexts[i - 1] : undefined;
            const next_text = i < sentenceTexts.length - 1 ? sentenceTexts[i + 1] : undefined;
            sentences.push({
                text: sentenceTexts[i],
                audioPromise: fetchTTSAudio(sentenceTexts[i], previous_text, next_text),
            });
        }

        // Phase 3: Play each sentence — typewriter text + audio simultaneously
        for (const s of sentences) {
            const audioUrl = await s.audioPromise;
            if (audioUrl) {
                await playSentenceWithText(s.text, audioUrl);
            } else {
                await typewriterText(s.text);
            }
        }

        finalizeResponse();
    } catch (err) {
        appendChat('system', `Error de conexion: ${err.message}`);
    }
}

async function fetchTTSAudio(text, previous_text, next_text) {
    try {
        const body = { text };
        if (previous_text) body.previous_text = previous_text;
        if (next_text) body.next_text = next_text;
        const res = await fetch(`${API_BASE}/api/voice/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
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

        // Wait for metadata so duration is accurate
        const startPlayback = () => {
            const duration = (audio.duration && isFinite(audio.duration)) ? audio.duration : 3;
            const msPerChar = (duration * 1000) / text.length;
            typewriterText(text, Math.max(msPerChar, 15));
        };

        audio.onloadedmetadata = () => {
            audio.play().catch(() => {
                typewriterText(text).then(resolve);
            });
        };

        audio.onplay = () => {
            startPlayback();
        };

        audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            resolve();
        };
        audio.onerror = () => {
            URL.revokeObjectURL(audioUrl);
            typewriterText(text).then(resolve);
        };
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

// Voice mic (pink) — Kaira responds with audio
export async function toggleRecordingVoice() {
    if (isRecording && activeRecordingButton === 'voice') {
        stopRecording();
    } else if (!isRecording) {
        activeRecordingButton = 'voice';
        voiceMode = true;
        await startRecording();
    }
}

// Text mic (blue) — Kaira responds with text only
export async function toggleRecordingText() {
    if (isRecording && activeRecordingButton === 'text') {
        stopRecording();
    } else if (!isRecording) {
        activeRecordingButton = 'text';
        voiceMode = false;
        await startRecording();
    }
}

// Keep legacy export for backwards compat
export async function toggleRecording() {
    await toggleRecordingVoice();
}

async function startRecording() {
    try {
        recordingMime = detectMimeType();
        if (!recordingMime) {
            appendChat('system', '⚠️ Browser does not support audio recording');
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
            updateMicButtons(false);
        };

        mediaRecorder.start(500);
        isRecording = true;
        updateMicButtons(true);
    } catch (err) {
        appendChat('system', `Micro no disponible: ${err.message}`);
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
    isRecording = false;
    updateMicButtons(false);
}

async function processRecordedAudio() {
    const blob = new Blob(audioChunks, { type: recordingMime });

    if (blob.size < 1000) {
        appendChat('system', '🎤 Audio too short, try again');
        return;
    }

    appendChat('system', '👱‍♀️ Kaira is listening...');

    try {
        const res = await fetch(`${API_BASE}/api/voice/transcribe`, {
            method: 'POST',
            body: blob,
            headers: { 'Content-Type': recordingMime },
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            if (errData.api_error) {
                removeSystemMessages('escuchando');
                appendChat('system', `\u26A0\uFE0F ${errData.error}`);
                return;
            }
            throw new Error(errData.error || `HTTP ${res.status}`);
        }

        const { text } = await res.json();
        removeSystemMessages('escuchando');

        if (!text || !text.trim()) {
            appendChat('system', '🎤 No voice detected, try again');
            return;
        }

        appendChat('user', text);
        await sendToAI(text);
    } catch (err) {
        removeSystemMessages('escuchando');
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
let currentTextNode = null;

function appendChat(role, text) {
    const chatLog = document.getElementById('chatLog');
    if (!chatLog) return;

    const div = document.createElement('div');
    div.className = `chat-msg chat-${role}`;
    if (role === 'system') {
        div.innerHTML = text;
    } else {
        const label = role === 'user' ? 'Tu' : 'Kaira';
        div.innerHTML = `<span class="chat-role">${label}:</span> ${text}`;
    }
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
        currentTextNode = document.createTextNode('');
        currentAssistantMsg.appendChild(currentTextNode);
        chatLog.appendChild(currentAssistantMsg);
    }

    currentTextNode.textContent += token;
    chatLog.scrollTop = chatLog.scrollHeight;
}

function finalizeResponse() {
    currentAssistantMsg = null;
    currentTextNode = null;
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

function updateMicButtons(recording) {
    const voiceBtn = document.getElementById('micVoice');
    const textBtn = document.getElementById('micText');

    if (recording) {
        // Highlight only the active button, dim the other
        if (activeRecordingButton === 'voice') {
            if (voiceBtn) voiceBtn.classList.add('recording');
            if (textBtn) { textBtn.style.opacity = '0.3'; textBtn.style.pointerEvents = 'none'; }
        } else {
            if (textBtn) textBtn.classList.add('recording');
            if (voiceBtn) { voiceBtn.style.opacity = '0.3'; voiceBtn.style.pointerEvents = 'none'; }
        }
    } else {
        // Reset both
        if (voiceBtn) { voiceBtn.classList.remove('recording'); voiceBtn.style.opacity = ''; voiceBtn.style.pointerEvents = ''; }
        if (textBtn) { textBtn.classList.remove('recording'); textBtn.style.opacity = ''; textBtn.style.pointerEvents = ''; }
    }
}
