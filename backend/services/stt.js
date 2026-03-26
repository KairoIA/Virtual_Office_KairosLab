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
            model: 'whisper-1',
            file: fs.createReadStream(tmpPath),
            language: 'es',
            prompt: 'Trading, MetaTrader, EA, StrategyQuant, portfolio, drawdown, backtesting, SQX, MCT',
        });

        return transcription.text;
    } finally {
        // Cleanup temp file
        fs.unlinkSync(tmpPath);
    }
}
