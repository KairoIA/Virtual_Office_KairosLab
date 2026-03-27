/**
 * KAIROS Tasks Module
 * Reminders, General Tasks, Completed History
 * CRUD, drag-and-drop reorder, dissolve animations
 */

import { Storage, DB_KEYS } from './storage.js';
import { renderCalendar }    from './calendar.js';

const ICONS = ['\uD83D\uDCC8', '\uD83E\uDDEA', '\uD83D\uDCCA', '\uD83D\uDCBC', '\uD83E\uDDE0', '\uD83D\uDCBB', '\uD83D\uDCB5', '\u2705\uFE0F', '\uD83D\uDD0D', '\u26A1', '\uD83D\uDCCB', '\uD83D\uDCC5', '\uD83C\uDFAF', '\uD83D\uDCA1', '\u2699\uFE0F'];
let selectedReminderIcon = '';
let selectedTaskIcon = '';
let draggedItem = null;
let draggedSource = null;

export function initTasks() {
    initPanelIconPickers();
    renderReminders();
    renderGenTasks();
    setupResizer();

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.icon-dropdown-wrapper')) {
            document.querySelectorAll('.icon-dropdown-content').forEach(el => el.classList.remove('show'));
        }
    });
}

// ── Reminders ────────────────────────────────────────────
export function addReminder() {
    const txtEl  = document.getElementById('newReminderText');
    const dateEl = document.getElementById('newReminderDate');
    if (!txtEl.value) return;
    const fullText = (selectedReminderIcon ? selectedReminderIcon + ' ' : '') + txtEl.value;
    Storage.addReminder(fullText, dateEl.value);
    txtEl.value = '';
    renderReminders();
    resetIconSelector('remIconBtn', 'reminderIcons', v => selectedReminderIcon = v);
}

export function renderReminders() {
    renderList('reminders', 'reminderList');
}

// ── General Tasks ────────────────────────────────────────
export function addGenTask() {
    const txtEl = document.getElementById('newGenTaskText');
    if (!txtEl.value) return;
    const fullText = (selectedTaskIcon ? selectedTaskIcon + ' ' : '') + txtEl.value;
    Storage.addTask(fullText);
    txtEl.value = '';
    renderGenTasks();
    resetIconSelector('taskIconBtn', 'taskIcons', v => selectedTaskIcon = v);
}

export function renderGenTasks() {
    renderList('tasks', 'genTaskList');
}

// ── Complete ─────────────────────────────────────────────
export function completeItem(dbKey, index) {
    const listId = dbKey === 'reminders' ? 'reminderList' : 'genTaskList';
    const itemEl = document.getElementById(listId).children[index];
    if (itemEl) itemEl.classList.add('dissolve-out');

    setTimeout(() => {
        const item = Storage.removeItem(dbKey, index);
        if (item) {
            Storage.addCompleted(item, dbKey === 'reminders' ? 'reminder' : 'task');
        }

        if (dbKey === 'reminders') renderReminders();
        else renderGenTasks();
        renderCalendar();
    }, 500);
}

// ── Edit / Delete ────────────────────────────────────────
export function editItem(dbKey, index) {
    const listId = dbKey === 'reminders' ? 'reminderList' : 'genTaskList';
    const storageKey = dbKey === 'reminders' ? DB_KEYS.REMINDERS : DB_KEYS.GENERAL;
    const list = JSON.parse(localStorage.getItem(storageKey) || '[]');
    const item = list[index];
    const container = document.getElementById(`text-${dbKey}-${index}`);

    const input = document.createElement('input');
    input.type = 'text';
    input.value = item.text;
    const save = () => {
        Storage.updateItemText(dbKey, index, input.value);
        if (dbKey === 'reminders') renderReminders();
        else renderGenTasks();
    };
    input.onkeydown = (e) => { if (e.key === 'Enter') save(); };
    input.onblur = save;
    container.innerHTML = '';
    container.appendChild(input);
    input.focus();
}

export function deleteItem(dbKey, index) {
    const listId = dbKey === 'reminders' ? 'reminderList' : 'genTaskList';
    const itemEl = document.getElementById(listId).children[index];
    if (itemEl) itemEl.classList.add('dissolve-out');

    setTimeout(() => {
        Storage.removeItem(dbKey, index);
        if (dbKey === 'reminders') renderReminders();
        else renderGenTasks();
        renderCalendar();
    }, 400);
}

// ── History ──────────────────────────────────────────────
export function renderHistory() {
    const history = Storage.getCompleted();
    history.sort((a, b) => new Date(b.date) - new Date(a.date));
    const el = document.getElementById('historyList');
    el.innerHTML = '';

    history.forEach((h, i) => {
        const icon = h.type === 'Reminder' ? '\uD83D\uDD14' : '\uD83D\uDCCB';
        const typeClass = h.type === 'Reminder' ? 'type-rem' : 'type-task';
        const durHtml = h.duration ? `<span class="history-duration">(${h.duration})</span>` : '';

        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
            <div class="history-info">
                <span class="history-date">[${h.date}]</span>
                <span class="${typeClass}">${icon}</span>
                <span class="history-text">${h.text} ${durHtml}</span>
            </div>
            <button class="del-hist-btn" data-hist-idx="${i}">\u2716</button>
        `;
        el.appendChild(div);
    });
}

export function deleteHistoryItem(index) {
    const history = Storage.getCompleted();
    history.sort((a, b) => new Date(b.date) - new Date(a.date));
    history.splice(index, 1);
    Storage.saveCompleted(history);
    renderHistory();
    renderCalendar();
}

export function toggleHistoryModal() {
    const m = document.getElementById('historyModal');
    if (m.style.display === 'flex') {
        m.style.display = 'none';
    } else {
        renderHistory();
        m.style.display = 'flex';
    }
}

// ── Side Panel ───────────────────────────────────────────
export function toggleSidePanel(forceOpen) {
    const el = document.getElementById('sidePanel');
    if (forceOpen) el.classList.add('open');
    else el.classList.toggle('open');
}

// ── Internals ────────────────────────────────────────────
function renderList(type, listId) {
    const isReminder = type === 'reminders';
    const list = isReminder ? Storage.getReminders() : Storage.getTasks();
    const el = document.getElementById(listId);
    el.innerHTML = '';

    list.forEach((item, i) => {
        const div = document.createElement('div');
        div.className = `item-card ${item.done ? 'done' : ''}`;
        div.draggable = true;

        div.addEventListener('dragstart', (e) => {
            draggedItem = i; draggedSource = type;
            e.target.classList.add('dragging');
        });
        div.addEventListener('dragend', (e) => {
            e.target.classList.remove('dragging');
            draggedItem = null; draggedSource = null;
        });
        div.addEventListener('dragover', (e) => e.preventDefault());
        div.addEventListener('drop', (e) => {
            e.preventDefault();
            if (draggedSource !== type || draggedItem === null) return;
            Storage.reorderItem(type, draggedItem, i);
            if (isReminder) renderReminders(); else renderGenTasks();
        });

        const dateHtml = isReminder ? `<span class="item-date">\uD83D\uDCC5 ${item.dueDate || 'Sin fecha'}</span>` : '';

        let ageHtml = '';
        if (!isReminder && item.createdAt) {
            const days = Math.floor((Date.now() - new Date(item.createdAt).getTime()) / 86400000);
            ageHtml = `<span class="task-age">${days}d</span>`;
        }

        div.innerHTML = `
            <div class="item-text" id="text-${type}-${i}">${item.text} ${dateHtml}</div>
            <div class="item-actions">
                ${ageHtml}
                <button class="action-btn complete-btn" data-type="${type}" data-idx="${i}" title="Completar" style="color:var(--success);border-color:var(--success)">\u2714</button>
                <button class="action-btn edit-btn" data-type="${type}" data-idx="${i}" title="Editar">\u270E</button>
                <button class="action-btn delete-btn" data-type="${type}" data-idx="${i}" title="Borrar" style="color:var(--danger);">\u2716</button>
            </div>
        `;
        el.appendChild(div);
    });

    // Delegate events
    el.querySelectorAll('.complete-btn').forEach(btn => {
        btn.onclick = () => completeItem(btn.dataset.type, parseInt(btn.dataset.idx));
    });
    el.querySelectorAll('.edit-btn').forEach(btn => {
        btn.onclick = () => editItem(btn.dataset.type, parseInt(btn.dataset.idx));
    });
    el.querySelectorAll('.delete-btn').forEach(btn => {
        btn.onclick = () => deleteItem(btn.dataset.type, parseInt(btn.dataset.idx));
    });

    if (isReminder) renderCalendar();
}

function initPanelIconPickers() {
    createPanelSelector('reminderIcons', 'remIconBtn', v => selectedReminderIcon = v);
    createPanelSelector('taskIcons', 'taskIconBtn', v => selectedTaskIcon = v);
}

function createPanelSelector(containerId, btnId, callback) {
    const container = document.getElementById(containerId);
    const btn = document.getElementById(btnId);
    if (!container || !btn) return;

    ICONS.forEach(icon => {
        const span = document.createElement('span');
        span.className = 'p-icon';
        span.innerText = icon;
        span.onclick = function () {
            Array.from(container.children).forEach(x => x.classList.remove('selected'));
            this.classList.add('selected');
            callback(icon);
            btn.innerHTML = icon;
            btn.classList.add('active');
            container.classList.remove('show');
        };
        container.appendChild(span);
    });
}

function resetIconSelector(btnId, containerId, callback) {
    callback('');
    const btn = document.getElementById(btnId);
    if (btn) { btn.innerHTML = '\uD83C\uDFF7\uFE0F'; btn.classList.remove('active'); }
    const container = document.getElementById(containerId);
    if (container) Array.from(container.children).forEach(c => c.classList.remove('selected'));
}

export function toggleIconMenu(id) {
    document.getElementById(id).classList.toggle('show');
}

function setupResizer() {
    const panel  = document.getElementById('sidePanel');
    const handle = document.getElementById('resizeHandle');
    if (!handle) return;
    let resizing = false;

    handle.addEventListener('mousedown', (e) => { resizing = true; document.body.style.cursor = 'ew-resize'; e.preventDefault(); });
    document.addEventListener('mousemove', (e) => {
        if (!resizing) return;
        const w = window.innerWidth - e.clientX;
        if (w > 300 && w < window.innerWidth * 0.9) panel.style.width = `${w}px`;
    });
    document.addEventListener('mouseup', () => { if (resizing) { resizing = false; document.body.style.cursor = 'default'; } });
}
