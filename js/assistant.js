/**
 * KAIROS Assistant Module
 * Chat + Voice interface connecting to the backend AI
 * Handles: text chat, mic recording, audio playback, WebSocket streaming
 */

const API_BASE = window.KAIROS_API_URL || 'https://www.kairoslaboffice.trade';
const WS_BASE  = window.KAIROS_WS_URL  || 'wss://www.kairoslaboffice.trade';

let ws = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let audioQueue = [];
let isPlaying = false;
let voiceMode = false; // Only play audio when user used the mic

// ── WebSocket Connection ─────────────────────────────
export function connectVoice() {
    if (ws && ws.readyState === WebSocket.OPEN) return;

    ws = new WebSocket(`${WS_BASE}/ws/voice`);

    ws.onopen = () => {
        console.log('[Kaira] Voice connected');
        updateStatus('connected');
    };

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
            case 'transcript':
                appendChat('user', msg.text);
                break;
            case 'token':
                appendToken(msg.text);
                break;
            case 'audio':
                if (voiceMode) queueAudio(msg.data);
                break;
            case 'function':
                showFunctionCall(msg.name, msg.result);
                break;
            case 'done':
                finalizeResponse();
                voiceMode = false; // Reset after response complete
                break;
            case 'error':
                appendChat('system', `Error: ${msg.message}`);
                break;
        }
    };

    ws.onclose = () => {
        console.log('[Kaira] Voice disconnected');
        updateStatus('disconnected');
        // Auto-reconnect after 3s
        setTimeout(connectVoice, 3000);
    };

    ws.onerror = (err) => {
        console.error('[Kaira] WS error:', err);
    };
}

// ── Text Chat ────────────────────────────────────────
export function sendTextMessage(text) {
    if (!text.trim()) return;

    voiceMode = false; // Text input = no audio response
    appendChat('user', text);

    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'text', message: text }));
    } else {
        // Fallback to REST
        sendTextREST(text);
    }
}

async function sendTextREST(text) {
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
        }
    } catch (err) {
        appendChat('system', `Connection error: ${err.message}`);
    }
}

// ── Voice Recording ──────────────────────────────────
export async function toggleRecording() {
    if (isRecording) {
        stopRecording();
    } else {
        await startRecording();
    }
}

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
        audioChunks = [];

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) audioChunks.push(e.data);
        };

        mediaRecorder.onstop = async () => {
            const blob = new Blob(audioChunks, { type: 'audio/webm' });
            stream.getTracks().forEach(t => t.stop());

            // Send audio via REST (more reliable through Cloudflare Tunnel)
            try {
                appendChat('system', 'Transcribiendo...');
                const formData = new FormData();
                formData.append('audio', blob, 'recording.webm');
                const res = await fetch(`${API_BASE}/api/voice/transcribe`, {
                    method: 'POST',
                    body: blob,
                    headers: { 'Content-Type': 'audio/webm' },
                });
                const { text } = await res.json();
                if (text) {
                    // Remove "Transcribiendo..." message
                    const chatLog = document.getElementById('chatLog');
                    const lastMsg = chatLog.lastElementChild;
                    if (lastMsg && lastMsg.textContent.includes('Transcribiendo')) lastMsg.remove();

                    appendChat('user', text);
                    // Send transcribed text to AI
                    const aiRes = await fetch(`${API_BASE}/api/voice/chat`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: text }),
                    });
                    const data = await aiRes.json();
                    appendChat('assistant', data.response);
                    if (data.functions_called?.length) {
                        data.functions_called.forEach(fc => showFunctionCall(fc.name, fc.result));
                    }
                    // Speak the response via TTS
                    if (voiceMode && data.response) {
                        speakText(data.response);
                    }
                }
            } catch (err) {
                appendChat('system', `Error de voz: ${err.message}`);
            }
        };

        mediaRecorder.start(250); // Collect chunks every 250ms
        isRecording = true;
        voiceMode = true; // Mic used = enable audio response
        updateMicButton(true);
    } catch (err) {
        console.error('[Mic] Error:', err);
        appendChat('system', 'No se pudo acceder al micrófono');
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
    isRecording = false;
    updateMicButton(false);
}

// ── Speak via REST TTS ───────────────────────────────
async function speakText(text) {
    try {
        const res = await fetch(`${API_BASE}/api/voice/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
        });
        if (!res.ok) return;
        const audioBlob = await res.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audio.onended = () => URL.revokeObjectURL(audioUrl);
        audio.play();
    } catch (err) {
        console.error('[TTS] Error:', err.message);
    }
}

// ── Audio Playback (WS TTS) ─────────────────────────
function queueAudio(base64Data) {
    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    audioQueue.push(bytes.buffer);

    if (!isPlaying) playNext();
}

async function playNext() {
    if (audioQueue.length === 0) {
        isPlaying = false;
        return;
    }
    isPlaying = true;

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const buffer = audioQueue.shift();

    try {
        const audioBuffer = await audioCtx.decodeAudioData(buffer);
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtx.destination);
        source.onended = () => {
            audioCtx.close();
            playNext();
        };
        source.start(0);
    } catch {
        // If decode fails, try next chunk
        playNext();
    }
}

// ── UI Helpers ───────────────────────────────────────
let currentAssistantMsg = null;

function appendChat(role, text) {
    const chatLog = document.getElementById('chatLog');
    if (!chatLog) return;

    const div = document.createElement('div');
    div.className = `chat-msg chat-${role}`;
    div.innerHTML = `<span class="chat-role">${role === 'user' ? 'Tú' : role === 'assistant' ? 'Kaira' : 'Sistema'}:</span> ${text}`;
    chatLog.appendChild(div);
    chatLog.scrollTop = chatLog.scrollHeight;

    if (role === 'assistant') currentAssistantMsg = null;
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
        btn.title = recording ? 'Detener grabación' : 'Hablar con Kaira';
    }
}
