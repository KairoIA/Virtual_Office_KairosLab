/**
 * KAIROS Tasks View Module
 * Standalone tasks tab with category filters and CRUD
 */

import { Storage } from './storage.js';
import { renderCalendar } from './calendar.js';

const API = window.KAIROS_API_URL || 'https://www.kairoslaboffice.trade';
let currentFilter = 'all';
let showCompleted = false;

export function initTasksView() {
    document.querySelectorAll('.task-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.task-filter').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.cat;
            renderTasksView();
        });
    });

    const cb = document.getElementById('tvShowCompleted');
    if (cb) cb.addEventListener('change', () => {
        showCompleted = cb.checked;
        const section = document.getElementById('tasksCompletedSection');
        if (section) section.style.display = showCompleted ? 'block' : 'none';
        if (showCompleted) renderCompletedHistory();
    });

    // Add task button
    const addBtn = document.getElementById('tvAddBtn');
    const addInput = document.getElementById('tvAddText');
    if (addBtn) addBtn.addEventListener('click', addTaskFromView);
    if (addInput) addInput.addEventListener('keydown', e => { if (e.key === 'Enter') addTaskFromView(); });
}

async function addTaskFromView() {
    const textInput = document.getElementById('tvAddText');
    const deadlineInput = document.getElementById('tvAddDeadline');
    const categorySelect = document.getElementById('tvAddCategory');
    const text = textInput?.value.trim();
    if (!text) return;

    const body = { text };
    if (deadlineInput?.value) body.deadline = deadlineInput.value;
    if (categorySelect?.value) body.category = categorySelect.value;

    await fetch(`${API}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    textInput.value = '';
    if (deadlineInput) deadlineInput.value = '';
    if (categorySelect) categorySelect.value = '';
    await Storage.refresh();
    renderTasksView();
    renderCalendar();
}

export function renderTasksView() {
    const el = document.getElementById('tasksViewList');
    if (!el) return;

    const allTasks = Storage.getTasks();
    const reminders = Storage.getReminders();
    const projects = Storage.getProjects();
    const projMap = {};
    projects.forEach(p => { projMap[p.id] = p.name; });
    const today = new Date().toISOString().split('T')[0];

    // Filter tasks (no category counts as General)
    let filtered = allTasks;
    if (currentFilter !== 'all') {
        filtered = allTasks.filter(t => (t.category || 'General') === currentFilter);
    }

    // Also show reminders (they're basically tasks with dates)
    let filteredRems = reminders.filter(r => !r.done);
    if (currentFilter !== 'all') {
        filteredRems = filteredRems.filter(r => (r.category || 'General') === currentFilter);
    }

    let html = '';

    // Tasks section
    if (filtered.length > 0) {
        html += '<div class="tv-section-title">\uD83D\uDCCB TASKS (' + filtered.length + ')</div>';
        filtered.forEach((t, i) => {
            const overdue = t.deadline && t.deadline < today && !t.done;
            const done = t.done;
            html += `<div class="tv-item ${done ? 'tv-done' : ''} ${overdue ? 'tv-overdue' : ''}">
                <div class="tv-item-main">
                    <div class="tv-item-text">${t.text}</div>
                    <div class="tv-item-meta">
                        ${t.category ? `<span class="tv-cat cat-${t.category}">${t.category}</span>` : '<span class="tv-cat cat-General">General</span>'}
                        ${t.project_id && projMap[t.project_id] ? `<span class="tv-project">\uD83D\uDCC1 ${projMap[t.project_id]}</span>` : ''}
                        ${t.deadline ? `<span class="tv-deadline ${overdue ? 'tv-deadline-overdue' : ''}">\uD83D\uDCC5 ${t.deadline}</span>` : ''}
                        ${t.priority ? `<span class="tv-prio tv-prio-${t.priority}">\u25CF</span>` : ''}
                    </div>
                </div>
                <div class="tv-item-actions">
                    <button class="tv-btn tv-edit" data-type="tasks" data-id="${t.id}" data-deadline="${t.deadline || ''}" data-category="${t.category || ''}" title="Editar">\u270E</button>
                    <button class="tv-btn tv-complete" data-type="tasks" data-id="${t.id}" title="Completar">\u2714</button>
                    <button class="tv-btn tv-delete" data-type="tasks" data-id="${t.id}" title="Borrar">\u2716</button>
                </div>
            </div>`;
        });
    }

    // Reminders section
    if (filteredRems.length > 0) {
        html += '<div class="tv-section-title" style="margin-top:20px">\uD83D\uDD14 REMINDERS (' + filteredRems.length + ')</div>';
        filteredRems.forEach(r => {
            const overdue = r.dueDate && r.dueDate < today;
            html += `<div class="tv-item ${overdue ? 'tv-overdue' : ''}">
                <div class="tv-item-main">
                    <div class="tv-item-text">${r.text}</div>
                    <div class="tv-item-meta">
                        ${r.category ? `<span class="tv-cat cat-${r.category}">${r.category}</span>` : '<span class="tv-cat cat-General">General</span>'}
                        ${r.project_id && projMap[r.project_id] ? `<span class="tv-project">\uD83D\uDCC1 ${projMap[r.project_id]}</span>` : ''}
                        ${r.dueDate ? `<span class="tv-deadline ${overdue ? 'tv-deadline-overdue' : ''}">\uD83D\uDCC5 ${r.dueDate}</span>` : '<span class="tv-deadline">Sin fecha</span>'}
                        ${r.priority ? `<span class="tv-prio tv-prio-${r.priority}">\u25CF</span>` : ''}
                    </div>
                </div>
                <div class="tv-item-actions">
                    <button class="tv-btn tv-edit" data-type="reminders" data-id="${r.id}" title="Editar">\u270E</button>
                    <button class="tv-btn tv-complete" data-type="reminders" data-id="${r.id}" title="Completar">\u2714</button>
                    <button class="tv-btn tv-delete" data-type="reminders" data-id="${r.id}" title="Borrar">\u2716</button>
                </div>
            </div>`;
        });
    }

    if (!filtered.length && !filteredRems.length) {
        html = '<p style="color:var(--text-muted); text-align:center; padding:30px;">No tasks in this category</p>';
    }

    el.innerHTML = html;

    // Bind buttons
    el.querySelectorAll('.tv-complete').forEach(btn => {
        btn.onclick = async () => {
            const type = btn.dataset.type;
            const id = btn.dataset.id;
            const endpoint = type === 'reminders' ? '/api/reminders' : '/api/tasks';
            // Get item text before deleting
            const itemEl = btn.closest('.tv-item');
            const text = itemEl?.querySelector('.tv-item-text')?.textContent || '';
            // Delete from source
            await fetch(`${API}${endpoint}/${id}`, { method: 'DELETE' });
            // Add to completed
            await fetch(`${API}/api/completed`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, type: type === 'reminders' ? 'Reminder' : 'Task' })
            });
            await Storage.refresh();
            renderTasksView();
            renderCalendar();
        };
    });
    el.querySelectorAll('.tv-edit').forEach(btn => {
        btn.onclick = () => {
            const type = btn.dataset.type;
            const id = btn.dataset.id;
            const endpoint = type === 'reminders' ? '/api/reminders' : '/api/tasks';
            const itemEl = btn.closest('.tv-item');
            const mainEl = itemEl.querySelector('.tv-item-main');
            const oldText = itemEl.querySelector('.tv-item-text').textContent;
            const oldDeadline = btn.dataset.deadline || '';
            const oldCategory = btn.dataset.category || '';

            const inputStyle = 'background:rgba(0,0,0,0.4);border:1px solid var(--highlight);color:var(--text-main);padding:6px 8px;border-radius:4px;font-size:0.85rem;';

            mainEl.innerHTML = `
                <div style="display:flex;gap:6px;flex-wrap:wrap;width:100%;align-items:center;">
                    <input type="text" id="tvEdit-${id}" value="${oldText.replace(/"/g, '&quot;')}" style="${inputStyle}flex:1;min-width:150px;">
                    ${type === 'tasks' ? `<input type="date" id="tvEditDl-${id}" value="${oldDeadline}" style="${inputStyle}width:120px;font-size:0.7rem;">` : ''}
                    ${type === 'tasks' ? `<select id="tvEditCat-${id}" style="${inputStyle}font-size:0.8rem;">
                        <option value="">Cat.</option>
                        <option value="Trading" ${oldCategory==='Trading'?'selected':''}>Trading</option>
                        <option value="Dev" ${oldCategory==='Dev'?'selected':''}>Dev</option>
                        <option value="IA" ${oldCategory==='IA'?'selected':''}>IA</option>
                        <option value="Bets" ${oldCategory==='Bets'?'selected':''}>Bets</option>
                        <option value="Personal" ${oldCategory==='Personal'?'selected':''}>Personal</option>
                        <option value="General" ${oldCategory==='General'?'selected':''}>General</option>
                    </select>` : ''}
                    <button style="background:var(--success);color:#000;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-weight:700;">OK</button>
                </div>
            `;

            const textInput = document.getElementById(`tvEdit-${id}`);
            textInput.focus();

            const save = async () => {
                const body = {};
                const newText = textInput.value.trim();
                if (newText && newText !== oldText) body.text = newText;
                if (type === 'tasks') {
                    const dlInput = document.getElementById(`tvEditDl-${id}`);
                    const catInput = document.getElementById(`tvEditCat-${id}`);
                    if (dlInput) body.deadline = dlInput.value || null;
                    if (catInput) body.category = catInput.value || null;
                }
                if (Object.keys(body).length > 0) {
                    await fetch(`${API}${endpoint}/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                    });
                    await Storage.refresh();
                }
                renderTasksView();
            };
            textInput.onkeydown = (e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') renderTasksView(); };
            mainEl.querySelector('button').onclick = save;
        };
    });
    el.querySelectorAll('.tv-delete').forEach(btn => {
        btn.onclick = async () => {
            const type = btn.dataset.type;
            const id = btn.dataset.id;
            const endpoint = type === 'reminders' ? '/api/reminders' : '/api/tasks';
            await fetch(`${API}${endpoint}/${id}`, { method: 'DELETE' });
            await Storage.refresh();
            renderTasksView();
            renderCalendar();
        };
    });

    // Refresh completed if visible
    if (showCompleted) renderCompletedHistory();
}

async function renderCompletedHistory() {
    const el = document.getElementById('tasksCompletedSection');
    if (!el) return;

    try {
        const res = await fetch(`${API}/api/completed`);
        const items = await res.json();

        if (!Array.isArray(items) || !items.length) {
            el.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:20px;">No completed items yet</p>';
            return;
        }

        // Group by date
        const byDate = {};
        items.forEach(item => {
            const d = item.completed_date || 'Unknown';
            if (!byDate[d]) byDate[d] = [];
            byDate[d].push(item);
        });

        let html = '<div class="tv-section-title" style="margin-top:20px">\u2705 COMPLETED HISTORY</div>';

        Object.keys(byDate).sort().reverse().forEach(date => {
            const dayItems = byDate[date];
            const label = formatDateLabel(date);
            html += `<div class="tv-completed-date">${label} <span class="tv-completed-count">(${dayItems.length})</span></div>`;
            dayItems.forEach(item => {
                html += `<div class="tv-item tv-done">
                    <div class="tv-item-main">
                        <div class="tv-item-text">\u2705 ${item.text}</div>
                        <div class="tv-item-meta">
                            <span class="tv-cat cat-${item.type || 'General'}">${item.type || 'Task'}</span>
                            ${item.duration && item.duration !== '0 days' ? `<span class="tv-deadline">\u23F1 ${item.duration}</span>` : ''}
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
