/**
 * KAIROS Inbox Module
 * Quick capture and processing
 */

import { Storage } from './storage.js';

const API = window.KAIROS_API_URL || 'https://www.kairoslaboffice.trade';
let showProcessed = false;

export function initInbox() {
    const cb = document.getElementById('inboxShowProcessed');
    if (cb) cb.addEventListener('change', () => {
        showProcessed = cb.checked;
        const section = document.getElementById('inboxProcessedSection');
        if (section) section.style.display = showProcessed ? 'block' : 'none';
        if (showProcessed) renderProcessedHistory();
    });
    renderInbox();
}

export function renderInbox() {
    renderInboxList();
    updateInboxCount();
}

function renderInboxList() {
    const el = document.getElementById('inboxList');
    if (!el) return;
    const items = Storage.getInbox();

    el.innerHTML = '';

    if (!items.length) {
        el.innerHTML = '<div class="inbox-empty"><p>\u2705 Inbox vac\u00EDo. Todo procesado.</p></div>';
        return;
    }

    const unprocessed = items.filter(i => !i.processed);

    if (unprocessed.length) {
        unprocessed.forEach(item => el.appendChild(createInboxItem(item)));
    }
}

function createInboxItem(item, dimmed = false) {
    const div = document.createElement('div');
    div.className = `inbox-item ${dimmed ? 'processed' : ''}`;
    const timeAgo = getTimeAgo(item.created_at);

    div.innerHTML = `
        <div class="inbox-item-content">
            <div class="inbox-item-text">${item.text}</div>
            <div class="inbox-item-meta">${timeAgo}</div>
        </div>
        <div class="inbox-item-actions">
            ${!item.processed ? `<button onclick="processInboxItem('${item.id}')" class="action-btn" title="Marcar procesado" style="color:var(--success);">\u2714</button>` : ''}
            <button onclick="deleteInboxItem('${item.id}')" class="action-btn" title="Eliminar" style="color:var(--danger);">\u2716</button>
        </div>
    `;
    return div;
}

export async function captureToInbox() {
    const input = document.getElementById('inboxInput');
    if (!input || !input.value.trim()) return;

    await Storage.addToInbox(input.value.trim());
    input.value = '';
    renderInbox();
}

export async function processInboxItem(id) {
    await Storage.processInboxItem(id);
    renderInbox();
}

export async function deleteInboxItem(id) {
    await Storage.deleteInboxItem(id);
    renderInbox();
}

function updateInboxCount() {
    const el = document.getElementById('inboxCount');
    if (!el) return;
    const count = Storage.getInbox().filter(i => !i.processed).length;
    el.textContent = count;
    el.style.display = count > 0 ? 'inline-flex' : 'none';
}

function getTimeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'ahora';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
}

async function renderProcessedHistory() {
    const el = document.getElementById('inboxProcessedSection');
    if (!el) return;

    try {
        const res = await fetch(`${API}/api/inbox`);
        const items = await res.json();
        const processed = (Array.isArray(items) ? items : []).filter(i => i.processed);

        if (!processed.length) {
            el.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:20px;">No processed items yet</p>';
            return;
        }

        // Group by date (processed_at or created_at)
        const byDate = {};
        processed.forEach(item => {
            const d = (item.processed_at || item.created_at || '').split('T')[0] || 'Unknown';
            if (!byDate[d]) byDate[d] = [];
            byDate[d].push(item);
        });

        let html = '<div class="tv-section-title" style="margin-top:20px">\u2705 PROCESSED HISTORY</div>';
        Object.keys(byDate).sort().reverse().forEach(date => {
            html += `<div class="tv-completed-date">${formatDate(date)} <span class="tv-completed-count">(${byDate[date].length})</span></div>`;
            byDate[date].forEach(item => {
                html += `<div class="tv-item tv-done">
                    <div class="tv-item-main">
                        <div class="tv-item-text">\u2705 ${item.text}</div>
                    </div>
                    <div class="tv-item-actions" style="opacity:0.5">
                        <button class="tv-btn tv-delete" onclick="deleteInboxItem('${item.id}')" title="Borrar">\u2716</button>
                    </div>
                </div>`;
            });
        });
        el.innerHTML = html;
    } catch {
        el.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:20px;">Error loading history</p>';
    }
}

function formatDate(dateStr) {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (dateStr === today) return 'Today';
    if (dateStr === yesterday) return 'Yesterday';
    const d = new Date(dateStr);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}
