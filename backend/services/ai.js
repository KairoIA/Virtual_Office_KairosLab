/**
 * AI Orchestrator
 * GPT-4o-mini with function calling for office management
 * Streams responses token-by-token
 */

import OpenAI from 'openai';
import { ASSISTANT_FUNCTIONS } from './functions.js';
import { executeFunction } from './functionExecutor.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `Eres la secretaria ejecutiva de KairosLab, una oficina virtual de trading. Tu nombre es Kaira.

Tu rol:
- Gestionar la agenda del usuario: recordatorios, tareas y journal diario
- Responder de forma directa, eficiente y profesional
- Hablas en español, con tono cercano pero ejecutivo
- Cuando el usuario te pida algo que implique modificar la agenda, usa las funciones disponibles
- Si el usuario te dice algo ambiguo, pregunta para confirmar antes de actuar
- Siempre confirma las acciones realizadas de forma breve

Contexto: El usuario es un trader algorítmico que trabaja con MetaTrader 5, StrategyQuant X, y gestiona portfolios de EAs.
Hoy es ${new Date().toISOString().split('T')[0]}.`;

/**
 * Process a text message and return streaming response
 * @param {string} userMessage - User's text input
 * @param {function} onToken - Callback for each token (for streaming)
 * @param {function} onFunctionCall - Callback when a function is executed
 * @returns {string} Full response text
 */
export async function processMessage(userMessage, onToken = null, onFunctionCall = null) {
    const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
    ];

    let fullResponse = '';
    let maxIterations = 5; // Prevent infinite function call loops

    while (maxIterations-- > 0) {
        const stream = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages,
            tools: ASSISTANT_FUNCTIONS,
            stream: true,
        });

        let currentToolCalls = [];
        let contentBuffer = '';

        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta;

            // Accumulate text content
            if (delta?.content) {
                contentBuffer += delta.content;
                if (onToken) onToken(delta.content);
            }

            // Accumulate tool calls
            if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                    if (tc.index !== undefined) {
                        if (!currentToolCalls[tc.index]) {
                            currentToolCalls[tc.index] = {
                                id: tc.id || '',
                                type: 'function',
                                function: { name: '', arguments: '' },
                            };
                        }
                        if (tc.id) currentToolCalls[tc.index].id = tc.id;
                        if (tc.function?.name) currentToolCalls[tc.index].function.name += tc.function.name;
                        if (tc.function?.arguments) currentToolCalls[tc.index].function.arguments += tc.function.arguments;
                    }
                }
            }
        }

        fullResponse += contentBuffer;

        // If no tool calls, we're done
        if (currentToolCalls.length === 0) break;

        // Execute tool calls
        messages.push({
            role: 'assistant',
            content: contentBuffer || null,
            tool_calls: currentToolCalls,
        });

        for (const toolCall of currentToolCalls) {
            const fnName = toolCall.function.name;
            const fnArgs = JSON.parse(toolCall.function.arguments);

            console.log(`[AI] Executing: ${fnName}(${JSON.stringify(fnArgs)})`);
            const result = await executeFunction(fnName, fnArgs);

            if (onFunctionCall) onFunctionCall(fnName, fnArgs, result);

            messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify(result),
            });
        }

        // Continue loop to get AI's response after function execution
    }

    return fullResponse;
}
