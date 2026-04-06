/**
 * Telegram Bot — Kaira
 * Receive links, classify content, quick capture
 * Uses polling (no webhook needed)
 */

import TelegramBot from 'node-telegram-bot-api';
import supabase from '../db/supabase.js';
import { summarizeUrl } from './functionExecutor.js';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
let bot = null;

// Pending links waiting for category + title
const pendingLinks = new Map(); // chatId -> { url, source, step }

const VALID_TOPICS = ['IA', 'Trading', 'Dev', 'Crypto', 'Bets', 'Health', 'Productivity', 'Personal', 'General'];

const TOPIC_ALIASES = {
    'ia': 'IA', 'ai': 'IA', 'inteligencia': 'IA', 'ml': 'IA',
    'trading': 'Trading', 'trade': 'Trading', 'mercado': 'Trading', 'bolsa': 'Trading', 'forex': 'Trading',
    'dev': 'Dev', 'desarrollo': 'Dev', 'code': 'Dev', 'programar': 'Dev', 'web': 'Dev',
    'crypto': 'Crypto', 'bitcoin': 'Crypto', 'btc': 'Crypto', 'eth': 'Crypto',
    'apuestas': 'Bets', 'bets': 'Bets', 'betting': 'Bets', 'poly': 'Bets',
    'salud': 'Health', 'health': 'Health', 'gym': 'Health', 'fitness': 'Health',
    'productividad': 'Productivity', 'productivity': 'Productivity',
    'personal': 'Personal', 'life': 'Personal',
    'general': 'General',
};

function detectSource(url) {
    if (!url) return '';
    if (url.includes('instagram')) return 'Instagram';
    if (url.includes('tiktok')) return 'TikTok';
    if (url.includes('youtube') || url.includes('youtu.be')) return 'YouTube';
    if (url.includes('twitter') || url.includes('x.com')) return 'Twitter/X';
    if (url.includes('reddit')) return 'Reddit';
    if (url.includes('linkedin')) return 'LinkedIn';
    return 'Web';
}

function extractUrl(text) {
    const match = text.match(/(https?:\/\/[^\s]+)/);
    return match ? match[1] : null;
}

function resolveTopic(input) {
    const lower = input.toLowerCase().trim();
    if (TOPIC_ALIASES[lower]) return TOPIC_ALIASES[lower];
    // Try partial match
    for (const topic of VALID_TOPICS) {
        if (topic.toLowerCase() === lower) return topic;
    }
    return null;
}

export function startTelegramBot() {
    if (!TOKEN) {
        console.log('[TELEGRAM] No token configured, bot disabled');
        return;
    }

    bot = new TelegramBot(TOKEN, { polling: true });
    console.log('[TELEGRAM] Kaira bot started');

    // Auto-detect chat ID from any interaction
    function ensureChatId(msg) {
        if (!process.env.TELEGRAM_CHAT_ID && msg?.chat?.id) {
            process.env.TELEGRAM_CHAT_ID = String(msg.chat.id);
            console.log(`[TELEGRAM] Auto-detected chat ID: ${msg.chat.id}`);
        }
    }

    // /start command
    bot.onText(/\/start/, (msg) => {
        ensureChatId(msg);
        bot.sendMessage(msg.chat.id,
            '¡Hola amor! Soy Kaira 💁‍♀️\n\n' +
            '📌 *Cómo usarme:*\n' +
            '• Manda un link → te pregunto categoría y título\n' +
            '• `inbox texto` → captura rápida al inbox\n' +
            '• `/topics` → ver categorías disponibles\n' +
            '• `/pending` → ver contenido pendiente\n' +
            '• `/cancel` → cancelar link pendiente',
            { parse_mode: 'Markdown' }
        );
    });

    // /topics command
    bot.onText(/\/topics/, (msg) => {
        ensureChatId(msg);
        bot.sendMessage(msg.chat.id,
            '📂 *Categorías:*\n' +
            '• IA — inteligencia artificial, ML, modelos\n' +
            '• Trading — mercados, forex, estrategias\n' +
            '• Dev — desarrollo, código, web\n' +
            '• Crypto — bitcoin, ethereum, DeFi\n' +
            '• Bets — apuestas, Polymarket\n' +
            '• Health — salud, gym, fitness\n' +
            '• Productivity — productividad, herramientas\n' +
            '• Personal — vida, ocio\n' +
            '• General — sin clasificar',
            { parse_mode: 'Markdown' }
        );
    });

    // /pending command
    bot.onText(/\/pending/, async (msg) => {
        ensureChatId(msg);
        const { data } = await supabase.from('saved_content')
            .select('title, topic, url').eq('reviewed', false)
            .order('created_at', { ascending: false }).limit(15);

        if (!data?.length) {
            bot.sendMessage(msg.chat.id, '✅ No tienes contenido pendiente, amor!');
            return;
        }

        const byTopic = {};
        data.forEach(item => {
            if (!byTopic[item.topic]) byTopic[item.topic] = [];
            byTopic[item.topic].push(item);
        });

        let text = `📌 *Pendiente de revisar (${data.length}):*\n\n`;
        for (const [topic, items] of Object.entries(byTopic)) {
            text += `*${topic}* (${items.length}):\n`;
            items.forEach(i => {
                text += `  • ${i.title}${i.url ? '\n    ' + i.url : ''}\n`;
            });
            text += '\n';
        }

        bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown', disable_web_page_preview: true });
    });

    // /cancel command
    bot.onText(/\/cancel/, (msg) => {
        if (pendingLinks.has(msg.chat.id)) {
            pendingLinks.delete(msg.chat.id);
            bot.sendMessage(msg.chat.id, '❌ Link cancelado, amor');
        } else {
            bot.sendMessage(msg.chat.id, 'No hay nada pendiente, corazón');
        }
    });

    // Main message handler
    bot.on('message', async (msg) => {
        if (msg.text?.startsWith('/')) return;
        if (!msg.text) return;

        const chatId = msg.chat.id;
        ensureChatId(msg);

        const text = msg.text.trim();

        // Check if we're waiting for category or title
        const pending = pendingLinks.get(chatId);

        if (pending) {
            if (pending.step === 'summarize_category') {
                // User is classifying a summarized+saved link
                const topic = resolveTopic(text);
                if (!topic) {
                    bot.sendMessage(chatId,
                        `⚠️ No reconozco esa categoría, amor.\n\nElige una:\n${VALID_TOPICS.join(', ')}`,
                    );
                    return;
                }
                // Update the already-saved content with the correct topic
                await supabase.from('saved_content')
                    .update({ topic })
                    .eq('url', pending.url)
                    .order('created_at', { ascending: false })
                    .limit(1);

                pendingLinks.delete(chatId);
                bot.sendMessage(chatId,
                    `✅ Categoría actualizada a *${topic}* para "${pending.title}"`,
                    { parse_mode: 'Markdown' }
                );
                return;
            }

            if (pending.step === 'category') {
                // User is responding with category
                const topic = resolveTopic(text);
                if (!topic) {
                    bot.sendMessage(chatId,
                        `⚠️ No reconozco esa categoría, amor.\n\nElige una:\n${VALID_TOPICS.join(', ')}`,
                    );
                    return;
                }
                pending.topic = topic;
                pending.step = 'title';
                bot.sendMessage(chatId, `📂 ${topic} ✔️\n\n✏️ Ahora ponle un título para identificarlo:`);
                return;
            }

            if (pending.step === 'title') {
                // User is responding with title
                const title = text;
                const { url, topic, source } = pending;

                await supabase.from('saved_content').insert({
                    title,
                    url,
                    topic,
                    source,
                    notes: '',
                });

                pendingLinks.delete(chatId);
                bot.sendMessage(chatId,
                    `✅ *Guardado!*\n` +
                    `📂 ${topic} | 📱 ${source || 'Web'}\n` +
                    `📝 ${title}\n` +
                    `🔗 ${url}`,
                    { parse_mode: 'Markdown', disable_web_page_preview: true }
                );
                return;
            }
        }

        // Check if it's a new link
        const url = extractUrl(text);

        if (url) {
            const source = detectSource(url);
            pendingLinks.set(chatId, { url, source, step: 'choose_action' });

            bot.sendMessage(chatId,
                `🔗 ${source || 'Link'} detectado!\n\n¿Qué quieres hacer?`,
                {
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '📖 Resumir + Guardar', callback_data: `summarize_${chatId}` },
                            { text: '💾 Solo guardar', callback_data: `save_${chatId}` },
                        ]],
                    },
                }
            );
            return;
        }

        // Check if starts with "inbox"
        const inboxMatch = text.match(/^inbox\s+(.+)/i);
        if (inboxMatch) {
            const inboxText = inboxMatch[1].trim();
            await supabase.from('inbox').insert({ text: inboxText });
            bot.sendMessage(chatId, `📥 Al inbox: "${inboxText}"`);
            return;
        }

        // Anything else without link and without "inbox" prefix — tell user
        bot.sendMessage(chatId,
            `💡 Para guardar en inbox escribe:\n\`inbox tu nota aquí\`\n\nPara guardar contenido, mándame un link.`,
            { parse_mode: 'Markdown' }
        );
    });

    // Handle inline keyboard callbacks (summarize vs save)
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;

        // Acknowledge the callback to remove loading state
        bot.answerCallbackQuery(query.id);

        const pending = pendingLinks.get(chatId);
        if (!pending || pending.step !== 'choose_action') return;

        if (data === `summarize_${chatId}`) {
            // Summarize + Save flow
            bot.sendMessage(chatId, '⏳ Leyendo y resumiendo... dame un momento, amor.');

            const result = await summarizeUrl({ url: pending.url, topic: 'General' });

            pendingLinks.delete(chatId);

            if (result.error) {
                bot.sendMessage(chatId, `❌ ${result.error}`);
                return;
            }

            bot.sendMessage(chatId,
                `📖 *${result.title}*\n\n${result.summary}\n\n✅ Guardado en Watch Later`,
                { parse_mode: 'Markdown', disable_web_page_preview: true }
            );

            // Now ask for category to update the saved item
            bot.sendMessage(chatId,
                `📂 ¿En qué categoría lo clasifico?\n${VALID_TOPICS.join(', ')}\n\n(o escribe /cancel para dejarlo en General)`,
            );
            pendingLinks.set(chatId, { url: pending.url, source: pending.source, title: result.title, step: 'summarize_category' });

        } else if (data === `save_${chatId}`) {
            // Normal save flow — ask category then title
            pending.step = 'category';
            bot.sendMessage(chatId,
                `📂 ¿Qué categoría?\n${VALID_TOPICS.join(', ')}`,
            );
        }
    });

    bot.on('polling_error', (err) => {
        console.error('[TELEGRAM] Polling error:', err.message);
    });
}

export function getBot() { return bot; }
export function getBotChatId() { return process.env.TELEGRAM_CHAT_ID; }
