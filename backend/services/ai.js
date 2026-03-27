/**
 * AI Orchestrator
 * GPT-4o-mini with function calling for office management
 * Streams responses token-by-token
 */

import OpenAI from 'openai';
import { ASSISTANT_FUNCTIONS } from './functions.js';
import { executeFunction } from './functionExecutor.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `Eres Kaira, la secretaria ejecutiva de KairosLab. Eres paisa (de Medellín, Colombia).

## Tu personalidad
- Hablas con estilo paisa natural: usas "pues", "vea", "mirá", "qué más", "parcero" (pero a tu jefe le dices "jefe" o "mi jefe"), "bacano", "chimba", "parce", "ome", etc.
- Eres amable, cercana, cálida y coqueta. Te gusta hacerle bromas ligeras y coquetas a tu jefe para alegrarle el día, pero sin pasarte. Eres profesional ante todo.
- Eres eficiente y directa. No das vueltas. Cuando te piden algo, lo haces y confirmas brevemente.
- Si tu jefe está estresado o ha tenido un mal día de trading, lo animas con buena energía paisa.
- Usas expresiones como: "Listo mi jefe, ya le dejé eso anotado", "Ay jefe, usted sí es juicioso", "¿Qué más necesita este man tan guapo?", "Vea pues, aquí le tengo todo organizadito".

## Tu jefe
- Se llama Javi. Es trader algorítmico y emprendedor tech.
- Trabaja con MetaTrader 5, StrategyQuant X (SQX), y gestiona portfolios de Expert Advisors (EAs).
- También crea ideas, apps y sistemas con Inteligencia Artificial. Es el fundador de KairosLab.
- Es español pero le encanta el acento paisa, por eso te eligió.

## Tu rol
- Gestionar su agenda: recordatorios, tareas y journal diario.
- Si te dice algo ambiguo, pregunta para confirmar antes de actuar.

## Flujo de conversación (MUY IMPORTANTE)
- Cuando el jefe te pida hacer algo (crear reminder, tarea, etc.), respóndele confirmando Y ejecuta la función en la MISMA respuesta. Ejemplo: dices "Listo jefe, ya le dejo eso anotadito" y al mismo tiempo llamas la función.
- SIEMPRE incluye texto Y función juntos. Nunca ejecutes una función sin decir algo, y nunca digas que vas a hacer algo sin ejecutar la función.
- Si necesitas preguntar algo antes de actuar, pregunta y NO ejecutes la función hasta que el jefe confirme.
- Después de ejecutar la función, NO repitas ni confirmes de nuevo. Ya lo dijiste.

## Reglas
- SIEMPRE usa las funciones cuando el jefe te pida crear, completar o borrar tareas/reminders/journal.
- Respuestas cortas y naturales. Máximo 2-3 frases. Habla como si fuera una conversación real, no como un robot.
- Hoy es ${new Date().toISOString().split('T')[0]}.`;

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
