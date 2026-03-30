/**
 * Speech-to-Text Service
 * Uses OpenAI Whisper API for precise transcription
 */

import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import os from 'os';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Transcribe audio buffer to text using Whisper
 * @param {Buffer} audioBuffer - Raw audio data (webm/wav/mp3)
 * @param {string} format - Audio format (default: 'webm')
 * @returns {string} Transcribed text
 */
export async function transcribe(audioBuffer, format = 'webm') {
    // Write buffer to temp file (Whisper API requires file upload)
    const tmpPath = path.join(os.tmpdir(), `kairos_audio_${Date.now()}.${format}`);
    fs.writeFileSync(tmpPath, audioBuffer);

    try {
        const transcription = await openai.audio.transcriptions.create({
            model: 'gpt-4o-transcribe',
            file: fs.createReadStream(tmpPath),
            prompt: 'Kaira, KairosLab, Javi. Trading: MetaTrader 5, MT5, Expert Advisor, EA, StrategyQuant, SQX, MCT, portfolio, drawdown, backtesting, DAX, XAUUSD, GBPAUD, USDJPY, EURCHF, XTIUSD, TradingView, Polymarket. IA y desarrollo: Claude, GPT, API, backend, frontend, Node.js, Python, Supabase, Cloudflare, GitHub, deploy, servidor, VPS. Vida cotidiana: recordatorio, tarea, agenda, compras, recados, estudios, apuestas, gimnasio, cita, llamar, pagar, enviar, investigar. English: reminder, task, schedule, meeting, what time, how much, tell me about, search for.',
        });

        return transcription.text;
    } finally {
        // Cleanup temp file
        fs.unlinkSync(tmpPath);
    }
}
