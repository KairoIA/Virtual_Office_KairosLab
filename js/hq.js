/**
 * KAIROS HQ / Today Module V4
 * Daily command center: briefing, FOR TODAY plan, radar with horizons, project load
 */

import { Storage } from './storage.js';
import { renderReminders } from './tasks.js';

const API = window.KAIROS_API_URL || 'https://www.kairoslaboffice.trade';

export function initHQ() {
    const buildBtn = document.getElementById('btnBuildSessions');
    if (buildBtn) buildBtn.addEventListener('click', buildDaySessions);
    renderHQ();
}

export function renderHQ() {
    renderDate();
    renderDaySessions();
    renderRadar();
    renderProjectLoad();
    renderBriefing();
}

// ── Daily quote cache ────────────────────────────────
let quotesCache = null;

async function loadQuotes() {
    if (quotesCache) return quotesCache;
    try {
        const res = await fetch('./data/quotes.json');
        quotesCache = await res.json();
    } catch { quotesCache = []; }
    return quotesCache;
}

function getDayOfYear(d) {
    const start = new Date(d.getFullYear(), 0, 0);
    return Math.floor((d - start) / 86400000);
}

function renderDate() {
    const el = document.getElementById('hqDate');
    if (!el) return;
    const d = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    el.textContent = `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;

    // Daily quote
    loadQuotes().then(quotes => {
        if (!quotes.length) return;
        const quoteEl = document.getElementById('hqDailyQuote');
        if (!quoteEl) return;
        const idx = getDayOfYear(d) % quotes.length;
        const q = quotes[idx];
        quoteEl.innerHTML = `<span class="daily-quote-text">"${q.q}"</span><span class="daily-quote-author">— ${q.a}</span>`;
    });
}

// ── DAY SESSIONS (4-block plan) ───────────────────────

const SESSION_META = {
    morning:   { icon: '\u{1F305}', label: 'Morning',     time: '08:00 – 11:30' },
    afternoon: { icon: '\u2600\uFE0F', label: 'Afternoon',  time: '11:30 – 14:30' },
    evening:   { icon: '\u{1F306}', label: 'Evening',     time: '17:00 – 19:30' },
    night:     { icon: '\u{1F319}', label: 'Early Night', time: '19:30 – 23:00' },
};

const DOMAIN_COLORS = {
    Trading: '#22c55e', Dev: '#58a6ff', Bets: '#d29922',
    IA: '#a371f7', Personal: '#8b949e', Estudio: '#00f2ff',
};

async function renderDaySessions() {
    const el = document.getElementById('hqDaySessions');
    if (!el) return;

    try {
        const today = new Date().toISOString().split('T')[0];
        const res = await fetch(`${API}/api/day-sessions?date=${today}`);
        const sessions = await res.json();

        // Group by slot
        const slotItems = {};
        if (Array.isArray(sessions)) {
            sessions.forEach(s => {
                if (!slotItems[s.slot]) slotItems[s.slot] = [];
                slotItems[s.slot].push(s);
            });
        }

        el.innerHTML = '';
        for (const [slot, meta] of Object.entries(SESSION_META)) {
            const items = slotItems[slot] || [];
            const div = document.createElement('div');
            div.className = `session-block ${items.length ? 'session-filled' : 'session-empty'}`;

            const primaryColor = items.length ? (DOMAIN_COLORS[items[0].domain] || '#8b949e') : '#8b949e';
            if (items.length) {
                div.style.borderLeftColor = primaryColor;
                div.style.background = `linear-gradient(90deg, ${primaryColor}12, transparent)`;
            }

            const itemsHtml = items.map(s => {
                const color = DOMAIN_COLORS[s.domain] || '#8b949e';
                const doneClass = s.done ? ' session-item-done' : '';
                return `<div class="session-item${doneClass}">
                    <button class="session-item-tick" onclick="toggleSessionDone('${s.id}', ${!s.done})" title="${s.done ? 'Reactivar' : 'Completar'}">${s.done ? '\u2705' : '\u2B1C'}</button>
                    <span class="session-domain" style="color:${color}">${s.domain}</span>
                    ${s.projects?.name ? `<span class="session-project">\u{1F4C1} ${s.projects.name}</span>` : ''}
                    ${s.focus_text ? `<span class="session-focus">${s.focus_text}</span>` : ''}
                    <button class="session-item-edit" onclick="editSessionItem('${s.id}', '${slot}', '${s.domain}', \`${(s.focus_text || '').replace(/`/g, '\\`')}\`)" title="Editar">\u270F\uFE0F</button>
                    <button class="session-item-del" onclick="clearSession('${s.id}')" title="Eliminar">\u2716</button>
                </div>`;
            }).join('');

            // Add item form
            const addFormHtml = `<div class="session-add-form" id="addForm-${slot}" style="display:none;">
                <select class="session-add-domain" id="addDomain-${slot}">
                    <option value="Trading">Trading</option><option value="Dev">Dev</option><option value="Bets">Bets</option>
                    <option value="IA">IA</option><option value="Personal">Personal</option><option value="Estudio">Estudio</option>
                </select>
                <input type="text" class="session-add-input" id="addText-${slot}" placeholder="Foco..." onkeydown="if(event.key==='Enter') addSessionItem('${slot}')">
                <button class="session-add-confirm" onclick="addSessionItem('${slot}')">\u2714</button>
                <button class="session-add-cancel" onclick="document.getElementById('addForm-${slot}').style.display='none'">\u2716</button>
            </div>`;

            div.innerHTML = `
                <div class="session-header">
                    <span class="session-icon">${meta.icon}</span>
                    <span class="session-label">${meta.label}</span>
                    <span class="session-time">${meta.time}</span>
                    <button class="session-add-btn" onclick="document.getElementById('addForm-${slot}').style.display='flex'" title="A\u00F1adir item">+</button>
                </div>
                <div class="session-body">${itemsHtml || '<div class="session-empty-text">Sin asignar</div>'}</div>
                ${addFormHtml}
            `;
            el.appendChild(div);
        }
    } catch {
        el.innerHTML = '<p class="text-muted" style="padding:10px;">Error cargando day plan</p>';
    }
}

async function buildDaySessions() {
    const btn = document.getElementById('btnBuildSessions');
    if (btn) { btn.disabled = true; btn.textContent = '\u23F3 Building...'; }

    try {
        const res = await fetch(`${API}/api/day-sessions/build`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        console.log('[HQ] Build day sessions response:', data);
        if (data.error) {
            console.error('[HQ] Build error:', data.error);
        }
        renderDaySessions();
    } catch (err) {
        console.error('[HQ] Build error:', err);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '\u26A1 Build'; }
    }
}

export async function clearSession(id) {
    await fetch(`${API}/api/day-sessions/${id}`, { method: 'DELETE' });
    renderDaySessions();
}

export async function addSessionItem(slot) {
    const domain = document.getElementById(`addDomain-${slot}`)?.value || 'Personal';
    const text = document.getElementById(`addText-${slot}`)?.value?.trim();
    if (!text) return;

    const today = new Date().toISOString().split('T')[0];
    await fetch(`${API}/api/day-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date_key: today, slot, domain, focus_text: text }),
    });
    renderDaySessions();
}

export async function editSessionItem(id, slot, domain, focusText) {
    const itemEl = document.querySelector(`[onclick*="editSessionItem('${id}'"]`)?.closest('.session-item');
    if (!itemEl) return;

    const origHtml = itemEl.innerHTML;
    itemEl.innerHTML = `
        <select class="session-add-domain" id="editDomain-${id}">
            ${['Trading', 'Dev', 'Bets', 'IA', 'Personal', 'Estudio'].map(d =>
                `<option value="${d}" ${d === domain ? 'selected' : ''}>${d}</option>`
            ).join('')}
        </select>
        <input type="text" class="session-add-input" id="editText-${id}" value="${focusText}" onkeydown="if(event.key==='Enter') saveSessionEdit('${id}'); if(event.key==='Escape') renderHQ();">
        <button class="session-add-confirm" onclick="saveSessionEdit('${id}')">\u2714</button>
        <button class="session-add-cancel" onclick="renderHQ()">\u2716</button>
    `;
    document.getElementById(`editText-${id}`)?.focus();
}

export async function saveSessionEdit(id) {
    const domain = document.getElementById(`editDomain-${id}`)?.value;
    const focusText = document.getElementById(`editText-${id}`)?.value?.trim();
    if (!focusText) return;

    await fetch(`${API}/api/day-sessions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, focus_text: focusText }),
    });
    renderDaySessions();
}

export async function toggleSessionDone(id, done) {
    await fetch(`${API}/api/day-sessions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done }),
    });
    renderDaySessions();
}

// ── Radar with horizons ─────────────────────────────
function renderRadar() {
    const el = document.getElementById('hqRadar');
    if (!el) return;
    const today = new Date().toISOString().split('T')[0];

    // Combine reminders (by dueDate) and tasks (by deadline) into unified radar
    const reminders = Storage.getReminders().filter(r => !r.done).map(r => ({ ...r, _date: r.dueDate, _type: 'R' }));
    const tasks = Storage.getTasks().filter(t => !t.done).map(t => ({ ...t, _date: t.deadline || '', _type: 'T' }));
    const allItems = [...reminders, ...tasks];

    const overdue = allItems.filter(r => r._date && r._date < today);
    const todayItems = allItems.filter(r => r._date === today);
    const next3 = allItems.filter(r => {
        if (!r._date) return false;
        const diff = (new Date(r._date) - new Date(today)) / 86400000;
        return diff > 0 && diff <= 3;
    });
    const next7 = allItems.filter(r => {
        if (!r._date) return false;
        const diff = (new Date(r._date) - new Date(today)) / 86400000;
        return diff > 3 && diff <= 7;
    });
    const next30 = allItems.filter(r => {
        if (!r._date) return false;
        const diff = (new Date(r._date) - new Date(today)) / 86400000;
        return diff > 7 && diff <= 30;
    });
    const noDate = allItems.filter(r => !r._date);

    el.innerHTML = '';

    if (overdue.length) el.innerHTML += radarSection('\u{1F534} OVERDUE', overdue, 'danger');
    if (todayItems.length) el.innerHTML += radarSection('\u{1F7E0} HOY', todayItems, 'warning');
    if (next3.length) el.innerHTML += radarSection('\u{1F535} 3 D\u00CDAS', next3, 'accent');
    if (next7.length) el.innerHTML += radarSection('\u{1F7E3} SEMANA', next7, 'general');
    if (next30.length) el.innerHTML += radarSection('\u26AA MES', next30, 'muted');
    if (noDate.length) el.innerHTML += radarSection('\u{1F4CC} SIN FECHA', noDate, 'muted');
    if (!allItems.length) {
        el.innerHTML = '<p class="text-muted" style="padding:10px;">Sin items pendientes</p>';
    }

    // Bind radar action buttons
    el.querySelectorAll('.radar-complete').forEach(btn => {
        btn.onclick = () => {
            const type = btn.dataset.type;
            const idx = parseInt(btn.dataset.idx);
            const item = Storage.removeItem(type === 'T' ? 'tasks' : 'reminders', idx);
            if (item) Storage.addCompleted(item, type === 'T' ? 'task' : 'reminder');
            renderRadar();
            if (typeof renderReminders === 'function') renderReminders();
        };
    });
    el.querySelectorAll('.radar-delete').forEach(btn => {
        btn.onclick = () => {
            const type = btn.dataset.type;
            const idx = parseInt(btn.dataset.idx);
            Storage.removeItem(type === 'T' ? 'tasks' : 'reminders', idx);
            renderRadar();
            if (typeof renderReminders === 'function') renderReminders();
        };
    });
}

function radarSection(title, items, color) {
    const prioColors = { red: '\u{1F534}', yellow: '\u{1F7E1}', green: '\u{1F7E2}' };
    const allReminders = Storage.getReminders();
    const allTasks = Storage.getTasks();
    const projects = Storage.getProjects();
    const projectMap = {};
    projects.forEach(p => { projectMap[p.id] = p.name; });

    const itemsHtml = items.map(r => {
        const prio = r.priority ? prioColors[r.priority] + ' ' : '';
        // Show project name if linked to a project, otherwise show category
        let catLabel = '';
        if (r.project_id && projectMap[r.project_id]) {
            catLabel = `<span class="radar-cat">[${projectMap[r.project_id]}]</span>`;
        } else if (r.category) {
            catLabel = `<span class="radar-cat">[${r.category}]</span>`;
        }
        const typeLabel = r._type === 'T' ? '<span class="radar-cat">[Task]</span>' : '';
        const source = r._type === 'T' ? allTasks : allReminders;
        const idx = source.findIndex(item => item.id === r.id);
        const dateStr = r._date || '';
        return `<div class="radar-item">
            <div class="radar-item-content">${prio}<span>${r.text}</span>${typeLabel}${catLabel}${dateStr ? `<span class="radar-date">${dateStr}</span>` : ''}</div>
            <div class="radar-item-actions">
                <button class="radar-btn radar-complete" data-idx="${idx}" data-type="${r._type}" title="Completar">\u2714</button>
                <button class="radar-btn radar-delete" data-idx="${idx}" data-type="${r._type}" title="Borrar">\u2716</button>
            </div>
        </div>`;
    }).join('');
    return `<div class="radar-section radar-${color}"><div class="radar-title">${title} (${items.length})</div>${itemsHtml}</div>`;
}

// ── Project Load ────────────────────────────────────
function renderProjectLoad() {
    const el = document.getElementById('hqProjectLoad');
    if (!el) return;
    const projects = Storage.getProjects();
    const domains = ['Trading', 'Dev', 'IA', 'Bets', 'Personal'];
    const statusColors = { active: 'var(--success)', paused: 'var(--warning)', blocked: 'var(--danger)', incubating: 'var(--general)' };

    el.innerHTML = '';

    domains.forEach(domain => {
        const domainProjects = projects.filter(p => p.domain === domain && p.status !== 'done');
        if (!domainProjects.length) return;

        const div = document.createElement('div');
        div.className = 'load-domain';
        div.innerHTML = `
            <div class="load-domain-name">${domain}</div>
            <div class="load-domain-bar">
                ${domainProjects.map(p => `<span class="load-chip" style="background:${statusColors[p.status] || 'var(--border)'}" title="${p.name} (${p.status})">${p.name.substring(0, 12)}</span>`).join('')}
            </div>
            <div class="load-count">${domainProjects.length}</div>
        `;
        el.appendChild(div);
    });

    if (!projects.filter(p => p.status !== 'done').length) {
        el.innerHTML = '<p class="text-muted" style="padding:10px;">Sin proyectos activos</p>';
    }
}

// ── Briefing ────────────────────────────────────────
async function renderBriefing() {
    const el = document.getElementById('hqBriefingContent');
    if (!el) return;

    const reminders = Storage.getReminders().filter(r => !r.done);
    const tasks = Storage.getTasks().filter(t => !t.done);
    const projects = Storage.getProjects().filter(p => p.status !== 'done');
    const inbox = Storage.getInbox().filter(i => !i.processed);
    const today = new Date().toISOString().split('T')[0];

    // This week: today through end of Sunday
    const todayDate = new Date(today);
    const daysUntilSun = 7 - todayDate.getDay();
    const endOfWeek = new Date(todayDate.getTime() + daysUntilSun * 86400000).toISOString().split('T')[0];

    // Today: reminders due today + tasks deadline today
    const todayReminders = reminders.filter(r => r.dueDate && r.dueDate <= today);
    const todayTasks = tasks.filter(t => t.deadline && t.deadline <= today);
    const todayItems = [
        ...todayReminders.map(r => `\u{1F514} ${r.text}${r.dueDate < today ? ' \u{1F534} overdue' : ''}`),
        ...todayTasks.map(t => `\u{1F4CB} ${t.text}${t.deadline < today ? ' \u{1F534} overdue' : ''}`),
    ];

    // This week: due between tomorrow and end of week
    const weekReminders = reminders.filter(r => r.dueDate && r.dueDate > today && r.dueDate <= endOfWeek);
    const weekTasks = tasks.filter(t => t.deadline && t.deadline > today && t.deadline <= endOfWeek);
    const weekItems = [
        ...weekReminders.map(r => `\u{1F514} ${r.text} [${r.dueDate}]`),
        ...weekTasks.map(t => `\u{1F4CB} ${t.text} [${t.deadline}]`),
    ];

    // All tasks (reminders + tasks combined)
    const allTaskItems = [
        ...reminders.map(r => `\u{1F514} ${r.text}${r.dueDate ? ' [' + r.dueDate + ']' : ''} (${r.category || 'General'})`),
        ...tasks.map(t => `\u{1F4CB} ${t.text}${t.deadline ? ' [' + t.deadline + ']' : ''} (${t.category || 'General'})`),
    ];

    // Projects
    const projectItems = projects.map(p => {
        const status = { active: '\u{1F7E2}', paused: '\u{1F7E1}', blocked: '\u{1F534}', incubating: '\u{1F7E3}' }[p.status] || '\u26AA';
        return `${status} [${p.domain || ''}] ${p.name}${p.next_action ? ' \u25B6 ' + p.next_action : ''}`;
    });

    // Watch Later (fetch from API)
    let watchLaterItems = [];
    try {
        const wlRes = await fetch(`${API}/api/content?reviewed=false`);
        const wlData = await wlRes.json();
        if (Array.isArray(wlData)) {
            watchLaterItems = wlData.map(c => `\u{1F4FA} [${c.topic}] ${c.title}`);
        }
    } catch { /* ignore */ }

    // Severity class: 1-5 normal, 5-15 warning, 15+ danger
    function severityCls(n) {
        if (n > 15) return 'stat-danger';
        if (n > 5) return 'stat-warning';
        return '';
    }

    const statData = [
        { num: todayItems.length, label: 'Today', cls: severityCls(todayItems.length), items: todayItems },
        { num: weekItems.length, label: 'This Week', cls: severityCls(weekItems.length), items: weekItems },
        { num: projects.length, label: 'Projects', cls: severityCls(projects.length), items: projectItems },
        { num: allTaskItems.length, label: 'Tasks', cls: severityCls(allTaskItems.length), items: allTaskItems },
        { num: inbox.length, label: 'Post-it', cls: severityCls(inbox.length), items: inbox.map(i => `\u{1F4CC} ${i.text}`) },
        { num: watchLaterItems.length, label: 'Watch Later', cls: severityCls(watchLaterItems.length), items: watchLaterItems },
    ];

    let html = '<div class="briefing-stats">';
    statData.forEach((s, i) => {
        html += `<div class="stat ${s.cls}" data-stat-idx="${i}" style="cursor:pointer"><span class="stat-num">${s.num}</span><span class="stat-label">${s.label}</span></div>`;
    });
    html += '</div>';

    // Alerts for critical items
    const overdue = [...reminders.filter(r => r.dueDate && r.dueDate < today), ...tasks.filter(t => t.deadline && t.deadline < today)];
    const blockedProjects = projects.filter(p => p.status === 'blocked');
    if (overdue.length) {
        html += '<div class="briefing-alert danger">\u{1F6A8} ' + overdue.length + ' item(s) retrasado(s)</div>';
    }
    if (blockedProjects.length) {
        html += '<div class="briefing-alert warning">\u26A0\uFE0F Bloqueado(s): ' + blockedProjects.map(p => p.name).join(', ') + '</div>';
    }

    // Detail popup container
    html += '<div id="briefingDetail" class="briefing-detail" style="display:none"></div>';

    el.innerHTML = html;

    // Bind click handlers
    el.querySelectorAll('.stat[data-stat-idx]').forEach(statEl => {
        statEl.onclick = () => {
            const idx = parseInt(statEl.dataset.statIdx);
            const s = statData[idx];
            const detail = document.getElementById('briefingDetail');
            if (!s.items.length) {
                detail.innerHTML = `<div class="detail-header">${s.label}</div><div class="detail-empty">No items</div>`;
            } else {
                detail.innerHTML = `<div class="detail-header">${s.label} (${s.num})</div>` +
                    s.items.map(item => `<div class="detail-item">${item}</div>`).join('');
            }
            detail.style.display = detail.style.display === 'none' ? 'block' : 'none';
        };
    });
}
