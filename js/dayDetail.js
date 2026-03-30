import { Storage } from './storage.js';
import { renderCalendar } from './calendar.js';

const API = window.KAIROS_API_URL || 'https://www.kairoslaboffice.trade';

export function openDayDetail(dateKey) {
    // Get all data for this date
    const reminders = Storage.getReminders().filter(r => r.dueDate === dateKey);
    const tasks = Storage.getTasks().filter(t => t.deadline === dateKey);
    const completed = Storage.getCompleted().filter(c => c.date === dateKey);
    const journal = Storage.getJournalEntry(dateKey);
    const projects = Storage.getProjects();
    const projMap = {};
    projects.forEach(p => { projMap[p.id] = p.name; });

    // Build the modal content
    const modal = document.getElementById('dayDetailModal');
    const content = document.getElementById('dayDetailContent');

    // Format date nicely
    const d = new Date(dateKey + 'T12:00:00');
    const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const dateTitle = `${dayNames[d.getDay()]}, ${monthNames[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;

    let html = `<div class="dd-header">
        <h2 class="dd-title">${dateTitle}</h2>
        <button class="dd-close" onclick="closeDayDetail()">&#10006;</button>
    </div><div class="dd-body">`;

    // Reminders section
    if (reminders.length > 0) {
        html += `<div class="dd-section"><div class="dd-section-title">&#128276; REMINDERS (${reminders.length})</div>`;
        reminders.forEach(r => {
            html += `<div class="dd-item">
                <div class="dd-item-text">${r.text}</div>
                <div class="dd-item-meta">
                    ${r.category ? `<span class="tv-cat cat-${r.category}">${r.category}</span>` : ''}
                    ${r.priority ? `<span class="tv-prio tv-prio-${r.priority}">&#9679;</span>` : ''}
                </div>
                <div class="dd-item-actions">
                    <button class="tv-btn tv-edit" onclick="dayDetailEdit('reminders','${r.id}','${dateKey}',this)" title="Editar">&#9998;</button>
                    <button class="tv-btn tv-complete" onclick="dayDetailComplete('reminders','${r.id}','${r.text.replace(/'/g, "\\'")}','${dateKey}')" title="Completar">&#10004;</button>
                    <button class="tv-btn tv-delete" onclick="dayDetailDelete('reminders','${r.id}','${dateKey}')" title="Borrar">&#10006;</button>
                </div>
            </div>`;
        });
        html += '</div>';
    }

    // Tasks section
    if (tasks.length > 0) {
        html += `<div class="dd-section"><div class="dd-section-title">&#128203; TASKS (${tasks.length})</div>`;
        tasks.forEach(t => {
            html += `<div class="dd-item">
                <div class="dd-item-text">${t.text}</div>
                <div class="dd-item-meta">
                    ${t.category ? `<span class="tv-cat cat-${t.category}">${t.category}</span>` : ''}
                    ${t.project_id && projMap[t.project_id] ? `<span class="tv-project">&#128193; ${projMap[t.project_id]}</span>` : ''}
                    ${t.priority ? `<span class="tv-prio tv-prio-${t.priority}">&#9679;</span>` : ''}
                </div>
                <div class="dd-item-actions">
                    <button class="tv-btn tv-edit" onclick="dayDetailEdit('tasks','${t.id}','${dateKey}',this)" title="Editar">&#9998;</button>
                    <button class="tv-btn tv-complete" onclick="dayDetailComplete('tasks','${t.id}','${t.text.replace(/'/g, "\\'")}','${dateKey}')" title="Completar">&#10004;</button>
                    <button class="tv-btn tv-delete" onclick="dayDetailDelete('tasks','${t.id}','${dateKey}')" title="Borrar">&#10006;</button>
                </div>
            </div>`;
        });
        html += '</div>';
    }

    // Completed section
    if (completed.length > 0) {
        html += `<div class="dd-section"><div class="dd-section-title">&#9989; COMPLETED (${completed.length})</div>`;
        completed.forEach(c => {
            html += `<div class="dd-item dd-completed">
                <div class="dd-item-text" style="text-decoration:line-through; opacity:0.6;">${c.text}</div>
                <div class="dd-item-meta"><span style="font-size:0.7rem; color:var(--text-muted);">${c.type || ''} ${c.duration || ''}</span></div>
            </div>`;
        });
        html += '</div>';
    }

    // Journal section
    if (journal) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = journal;
        const plainText = tempDiv.textContent || '';
        html += `<div class="dd-section"><div class="dd-section-title">&#128211; JOURNAL</div>
            <div class="dd-journal">${plainText.substring(0, 500)}${plainText.length > 500 ? '...' : ''}</div>
        </div>`;
    }

    // If nothing for this day
    if (!reminders.length && !tasks.length && !completed.length && !journal) {
        html += '<div style="text-align:center; color:var(--text-muted); padding:30px;">Nothing scheduled for this day</div>';
    }

    html += '</div>';
    content.innerHTML = html;
    modal.classList.add('active');
}

export function closeDayDetail() {
    document.getElementById('dayDetailModal').classList.remove('active');
}

export async function dayDetailComplete(type, id, text, dateKey) {
    const endpoint = type === 'reminders' ? '/api/reminders' : '/api/tasks';
    await fetch(`${API}${endpoint}/${id}`, { method: 'DELETE' });
    await fetch(`${API}/api/completed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, type: type === 'reminders' ? 'Reminder' : 'Task' })
    });
    await Storage.refresh();
    renderCalendar();
    openDayDetail(dateKey); // Refresh the modal
}

export async function dayDetailDelete(type, id, dateKey) {
    const endpoint = type === 'reminders' ? '/api/reminders' : '/api/tasks';
    await fetch(`${API}${endpoint}/${id}`, { method: 'DELETE' });
    await Storage.refresh();
    renderCalendar();
    openDayDetail(dateKey);
}

export function dayDetailEdit(type, id, dateKey, btnEl) {
    const item = btnEl.closest('.dd-item');
    const textEl = item.querySelector('.dd-item-text');
    const oldText = textEl.textContent;
    const endpoint = type === 'reminders' ? '/api/reminders' : '/api/tasks';

    const input = document.createElement('input');
    input.type = 'text';
    input.value = oldText;
    input.style.cssText = 'width:100%;background:rgba(0,0,0,0.4);border:1px solid var(--highlight);color:var(--text-main);padding:6px 10px;border-radius:4px;font-size:0.85rem;';
    textEl.innerHTML = '';
    textEl.appendChild(input);
    input.focus();

    const save = async () => {
        const newText = input.value.trim();
        if (newText && newText !== oldText) {
            await fetch(`${API}${endpoint}/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: newText })
            });
            await Storage.refresh();
            renderCalendar();
        }
        openDayDetail(dateKey);
    };
    input.onkeydown = (e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') openDayDetail(dateKey); };
    input.onblur = save;
}
