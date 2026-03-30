/**
 * Text-to-Speech Service
 * Uses ElevenLabs streaming API for real-time voice synthesis
 */

/**
 * Stream text to speech via ElevenLabs
 * Sends audio chunks as they're generated for minimal latency
 * @param {string} text - Text to synthesize
 * @param {function} onAudioChunk - Callback with each audio chunk (Buffer)
 * @param {function} onDone - Callback when synthesis is complete
 */
export async function streamTTS(text, onAudioChunk, onDone = null) {
    const voiceId = process.env.ELEVENLABS_VOICE_ID;
    const apiKey = process.env.ELEVENLABS_API_KEY;

    const body = {
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
        },
        output_format: 'mp3_44100_128',
    };

    const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'xi-api-key': apiKey,
            },
            body: JSON.stringify(body),
        }
    );

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`ElevenLabs error: ${response.status} ${err}`);
    }

    const reader = response.body.getReader();
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        onAudioChunk(Buffer.from(value));
    }

    if (onDone) onDone();
}

/**
 * Stream TTS from a token stream (for real-time LLM → TTS pipeline)
 * Buffers tokens until a sentence boundary, then sends to ElevenLabs
 * @param {AsyncIterable} tokenStream - Stream of text tokens
 * @param {function} onAudioChunk - Callback with audio chunks
 */
export async function streamTTSFromTokens(tokenStream, onAudioChunk) {
    let buffer = '';
    const SENTENCE_ENDINGS = /[.!?;:,\n]+\s*/;

    for await (const token of tokenStream) {
        buffer += token;

        // Check if we have a complete sentence to send
        if (SENTENCE_ENDINGS.test(buffer) && buffer.trim().length > 20) {
            const textToSpeak = buffer.trim();
            buffer = '';

            // Fire and forget each sentence — they'll stream in order
            streamTTS(textToSpeak, onAudioChunk).catch(err => {
                console.error('[TTS] Stream error:', err.message);
            });
        }
    }

    // Send remaining text
    if (buffer.trim()) {
        await streamTTS(buffer.trim(), onAudioChunk);
    }
}
