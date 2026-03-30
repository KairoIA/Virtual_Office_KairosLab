/**
 * KAIROS Library Module
 * Saved content from Telegram / Kaira — organized by topic
 */

const API = window.KAIROS_API_URL || 'https://www.kairoslaboffice.trade';
let currentTopic = 'all';
let showReviewed = false;

export function initLibrary() {
    setupLibraryFilters();
    setupReviewedToggle();
    renderLibrary();
}

export async function renderLibrary() {
    const el = document.getElementById('libraryList');
    if (!el) return;

    try {
        let url = `${API}/api/content?`;
        if (currentTopic !== 'all') url += `topic=${currentTopic}&`;
        if (!showReviewed) url += 'reviewed=false';

        const res = await fetch(url);
        const items = await res.json();

        // Update count
        const countEl = document.getElementById('libraryCount');
        if (countEl) {
            const pending = Array.isArray(items) ? items.filter(i => !i.reviewed).length : 0;
            countEl.textContent = pending;
            countEl.style.display = pending > 0 ? 'inline-flex' : 'none';
        }

        el.innerHTML = '';

        if (!Array.isArray(items) || !items.length) {
            el.innerHTML = '<div class="inbox-empty"><p>\u{1F4DA} Sin contenido' + (currentTopic !== 'all' ? ` en ${currentTopic}` : '') + '. Manda links por Telegram!</p></div>';
            return;
        }

        items.forEach(item => {
            const div = document.createElement('div');
            div.className = `library-item ${item.reviewed ? 'reviewed' : ''}`;

            const sourceIcon = {
                'Instagram': '\u{1F4F7}', 'TikTok': '\u{1F3B5}', 'YouTube': '\u{1F3AC}',
                'Twitter/X': '\u{1F426}', 'Reddit': '\u{1F4AC}', 'Web': '\u{1F310}',
            }[item.source] || '\u{1F4CE}';

            div.innerHTML = `
                <div class="library-item-main">
                    <div class="library-item-top">
                        <span class="library-topic topic-${item.topic}">${item.topic}</span>
                        <span class="library-source">${sourceIcon} ${item.source || 'Unknown'}</span>
                        <span class="library-date">${getTimeAgo(item.created_at)}</span>
                    </div>
                    <div class="library-title">${item.title}</div>
                    ${item.url ? `<a href="${item.url}" target="_blank" class="library-url">${item.url}</a>` : ''}
                    ${item.notes ? `<div class="library-notes">${item.notes}</div>` : ''}
                </div>
                <div class="library-actions">
                    ${!item.reviewed ? `<button onclick="markLibraryReviewed('${item.id}')" class="action-btn" title="Marcar como visto" style="color:var(--success);">\u2714</button>` : '<span style="color:var(--success);font-size:0.8rem;">\u2705</span>'}
                    <button onclick="deleteLibraryItem('${item.id}')" class="action-btn" title="Eliminar" style="color:var(--danger);">\u2716</button>
                </div>
            `;
            el.appendChild(div);
        });
    } catch (err) {
        el.innerHTML = '<div class="inbox-empty"><p>Error cargando la library</p></div>';
    }
}

function setupLibraryFilters() {
    document.querySelectorAll('#libraryFilters .filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#libraryFilters .filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTopic = btn.dataset.topic;
            renderLibrary();
        });
    });
}

function setupReviewedToggle() {
    const cb = document.getElementById('libraryShowReviewed');
    if (cb) cb.addEventListener('change', () => {
        showReviewed = cb.checked;
        renderLibrary();
        const section = document.getElementById('libraryReviewedSection');
        if (section) {
            section.style.display = showReviewed ? 'block' : 'none';
            if (showReviewed) renderReviewedHistory();
        }
    });
}

export async function markLibraryReviewed(id) {
    await fetch(`${API}/api/content/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewed: true }),
    });
    renderLibrary();
}

export async function deleteLibraryItem(id) {
    await fetch(`${API}/api/content/${id}`, { method: 'DELETE' });
    renderLibrary();
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

async function renderReviewedHistory() {
    const el = document.getElementById('libraryReviewedSection');
    if (!el) return;

    try {
        const res = await fetch(`${API}/api/content?reviewed=true`);
        const items = await res.json();

        if (!Array.isArray(items) || !items.length) {
            el.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:20px;">No reviewed content yet</p>';
            return;
        }

        // Group by date (reviewed_at or created_at)
        const byDate = {};
        items.forEach(item => {
            const d = (item.reviewed_at || item.created_at || '').split('T')[0] || 'Unknown';
            if (!byDate[d]) byDate[d] = [];
            byDate[d].push(item);
        });

        let html = '<div class="tv-section-title" style="margin-top:20px">\u2705 REVIEWED HISTORY</div>';
        Object.keys(byDate).sort().reverse().forEach(date => {
            const label = formatDateLabel(date);
            html += `<div class="tv-completed-date">${label} <span class="tv-completed-count">(${byDate[date].length})</span></div>`;
            byDate[date].forEach(item => {
                html += `<div class="tv-item tv-done">
                    <div class="tv-item-main">
                        <div class="tv-item-text">\u2705 ${item.title}</div>
                        <div class="tv-item-meta">
                            <span class="library-topic topic-${item.topic}">${item.topic}</span>
                            <span style="font-size:0.7rem; color:var(--text-muted);">${item.source || ''}</span>
                            ${item.url ? `<a href="${item.url}" target="_blank" style="font-size:0.7rem; color:var(--accent);">link</a>` : ''}
                        </div>
                    </div>
                </div>`;
            });
        });
        el.innerHTML = html;
    } catch {
        el.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:20px;">Error loading history</p>';
    }
}

function formatDateLabel(dateStr) {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (dateStr === today) return 'Today';
    if (dateStr === yesterday) return 'Yesterday';
    const d = new Date(dateStr);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}
