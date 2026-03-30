/**
 * KAIROS Projects Module
 * Project cards with status, objective, and actions
 */

import { Storage } from './storage.js';

const API = window.KAIROS_API_URL || 'https://www.kairoslaboffice.trade';
let currentFilter = 'all';
let showCompletedProjects = false;

export function initProjects() {
    setupFilters();
    setupAddButton();
    renderProjects();
}

export function renderProjects() {
    const el = document.getElementById('projectsGrid');
    if (!el) return;
    const projects = Storage.getProjects();

    const filtered = currentFilter === 'all'
        ? projects
        : projects.filter(p => p.domain === currentFilter);

    el.innerHTML = '';

    if (!filtered.length) {
        el.innerHTML = '<div class="no-projects"><p>Sin proyectos' + (currentFilter !== 'all' ? ` en ${currentFilter}` : '') + '</p></div>';
        return;
    }

    const statusOrder = { active: 0, blocked: 1, paused: 2, incubating: 3, done: 4 };
    filtered.sort((a, b) => (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0));

    filtered.forEach(p => {
        const card = document.createElement('div');
        card.className = `project-card status-${p.status}`;
        card.innerHTML = `
            <div class="project-card-top">
                <span class="project-domain domain-${p.domain}">${p.domain}</span>
                <span class="project-type-badge type-${p.project_type || 'temporal'}">${(p.project_type || 'temporal') === 'permanent' ? '\u267E Permanente' : '\u{1F3AF} Temporal'}</span>
                <span class="project-status">${statusIcon(p.status)} ${p.status}</span>
            </div>
            <h4 class="project-name">${p.name}</h4>
            ${p.objective ? `<div class="project-field"><span class="field-label">\u{1F3AF} Objetivo:</span> ${p.objective}</div>` : ''}
            ${p.notes ? `<div class="project-notes">${truncate(p.notes, 120)}</div>` : ''}
            <div class="project-meta">
                <span>Creado: ${new Date(p.created_at).toLocaleDateString()}</span>
                ${p.updated_at !== p.created_at ? `<span>Actualizado: ${new Date(p.updated_at).toLocaleDateString()}</span>` : ''}
            </div>
            <div class="project-actions">
                <button onclick="editProject('${p.id}')" class="action-btn" title="Editar">\u270E</button>
                <button onclick="toggleProjectTasks('${p.id}')" class="action-btn" title="Tareas">\u2611</button>
                <button onclick="toggleProjectNotes('${p.id}')" class="action-btn" title="Notas">\u{1F4DD}</button>
                ${(p.project_type || 'temporal') === 'temporal' && p.status !== 'done' ? `<button onclick="completeProject('${p.id}')" class="action-btn" title="Completar" style="color:var(--success);">\u2705</button>` : ''}
                <button onclick="toggleProjectStatus('${p.id}', '${p.status}')" class="action-btn" title="Cambiar estado">\u{1F504}</button>
                <button onclick="deleteProject('${p.id}')" class="action-btn" title="Eliminar" style="color:var(--danger);">\u2716</button>
            </div>
            <div class="project-notes-panel" id="projTasks-${p.id}" style="display:none">
                <div class="pn-header">
                    <span>\u2611 Tareas</span>
                </div>
                <div class="pn-add">
                    <input type="text" class="pn-input" id="ptInput-${p.id}" placeholder="A\u00f1adir tarea..." style="flex:1;" onkeydown="if(event.key==='Enter') addProjectTask('${p.id}')">
                    <input type="date" class="pn-input" id="ptDeadline-${p.id}" style="width:120px; font-size:0.7rem;">
                    <button class="pn-add-btn" onclick="addProjectTask('${p.id}')">+</button>
                </div>
                <div class="pn-list" id="ptList-${p.id}"></div>
            </div>
            <div class="project-notes-panel" id="projNotes-${p.id}" style="display:none">
                <div class="pn-header">
                    <span>\u{1F4DD} Project Log</span>
                </div>
                <div class="pn-add">
                    <input type="text" class="pn-input" id="pnInput-${p.id}" placeholder="A\u00f1adir nota..." onkeydown="if(event.key==='Enter') addProjectNote('${p.id}')">
                    <button class="pn-add-btn" onclick="addProjectNote('${p.id}')">+</button>
                </div>
                <div class="pn-list" id="pnList-${p.id}"></div>
            </div>
        `;
        el.appendChild(card);
    });
}

function statusIcon(status) {
    const icons = { active: '\u{1F7E2}', paused: '\u{1F7E1}', blocked: '\u{1F534}', incubating: '\u{1F7E3}', done: '\u2705' };
    return icons[status] || '\u26AA';
}

function truncate(text, max) {
    return text.length > max ? text.substring(0, max) + '...' : text;
}

function setupFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderProjects();
        });
    });
}

function setupAddButton() {
    const btn = document.getElementById('btnAddProject');
    if (btn) btn.addEventListener('click', () => openProjectModal());

    const cb = document.getElementById('projShowCompleted');
    if (cb) cb.addEventListener('change', () => {
        showCompletedProjects = cb.checked;
        const section = document.getElementById('projectsCompletedSection');
        if (section) section.style.display = showCompletedProjects ? 'block' : 'none';
        if (showCompletedProjects) renderCompletedProjects();
    });
}

function renderCompletedProjects() {
    const el = document.getElementById('projectsCompletedSection');
    if (!el) return;
    const projects = Storage.getProjects().filter(p => p.status === 'done');

    if (!projects.length) {
        el.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:20px;">No completed projects yet</p>';
        return;
    }

    // Sort by completed_at desc
    projects.sort((a, b) => (b.completed_at || b.updated_at || '').localeCompare(a.completed_at || a.updated_at || ''));

    let html = '<div class="tv-section-title" style="margin-top:20px">\u2705 COMPLETED PROJECTS</div>';
    projects.forEach(p => {
        const date = p.completed_at ? new Date(p.completed_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Unknown';
        html += `<div class="tv-item tv-done" style="opacity:0.6">
            <div class="tv-item-main">
                <div class="tv-item-text">\u2705 ${p.name}</div>
                <div class="tv-item-meta">
                    <span class="tv-cat cat-${p.domain || 'General'}">${p.domain}</span>
                    <span class="tv-deadline">\u{1F4C5} ${date}</span>
                    ${p.objective ? `<span style="color:var(--text-muted); font-size:0.7rem;">${p.objective}</span>` : ''}
                </div>
            </div>
        </div>`;
    });
    el.innerHTML = html;
}

// ── Modal ────────────────────────────────────────────
export function openProjectModal(project = null) {
    const modal = document.getElementById('projectModal');
    document.getElementById('projectModalTitle').textContent = project ? 'EDIT PROJECT' : 'NEW PROJECT';
    document.getElementById('projEditId').value = project?.id || '';
    document.getElementById('projName').value = project?.name || '';
    document.getElementById('projType').value = project?.project_type || 'temporal';
    document.getElementById('projDomain').value = project?.domain || 'Personal';
    document.getElementById('projStatus').value = project?.status || 'active';
    document.getElementById('projObjective').value = project?.objective || '';
    document.getElementById('projNotes').value = project?.notes || '';
    modal.style.display = 'flex';
}

export function closeProjectModal() {
    document.getElementById('projectModal').style.display = 'none';
}

export async function saveProjectFromModal() {
    const id = document.getElementById('projEditId').value;
    const data = {
        name: document.getElementById('projName').value,
        project_type: document.getElementById('projType').value,
        domain: document.getElementById('projDomain').value,
        status: document.getElementById('projStatus').value,
        objective: document.getElementById('projObjective').value,
        notes: document.getElementById('projNotes').value,
    };

    if (!data.name) return;

    if (id) {
        await Storage.updateProject(id, data);
    } else {
        await Storage.addProject(data);
    }

    closeProjectModal();
    renderProjects();
}

export function editProject(id) {
    const project = Storage.getProjects().find(p => p.id === id);
    if (project) openProjectModal(project);
}

export async function toggleProjectStatus(id, currentStatus) {
    const cycle = { active: 'paused', paused: 'active', blocked: 'active', incubating: 'active', done: 'active' };
    await Storage.updateProject(id, { status: cycle[currentStatus] || 'active' });
    renderProjects();
}

export async function completeProject(id) {
    if (!confirm('Marcar proyecto como completado?')) return;
    await Storage.updateProject(id, { status: 'done', completed_at: new Date().toISOString() });
    renderProjects();
}

export async function deleteProject(id) {
    if (!confirm('Eliminar este proyecto?')) return;
    await Storage.deleteProject(id);
    renderProjects();
}

// ── Project Notes ────────────────────────────────────

export async function toggleProjectNotes(projectId) {
    const panel = document.getElementById(`projNotes-${projectId}`);
    if (!panel) return;
    const isHidden = panel.style.display === 'none';
    panel.style.display = isHidden ? 'block' : 'none';
    if (isHidden) loadProjectNotes(projectId);
}

async function loadProjectNotes(projectId) {
    const list = document.getElementById(`pnList-${projectId}`);
    if (!list) return;

    try {
        const res = await fetch(`${API}/api/project-notes/${projectId}`);
        const notes = await res.json();

        if (!Array.isArray(notes) || !notes.length) {
            list.innerHTML = '<p class="text-muted" style="font-size:0.75rem; padding:4px 0;">Sin notas a\u00fan</p>';
            return;
        }

        list.innerHTML = notes.map(n => {
            const date = new Date(n.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
            return `<div class="pn-item">
                <span class="pn-date">${date}</span>
                <span class="pn-text">${n.content}</span>
                <button class="pn-del" onclick="deleteProjectNote('${n.id}', '${projectId}')">\u2716</button>
            </div>`;
        }).join('');
    } catch {
        list.innerHTML = '<p class="text-muted" style="font-size:0.75rem;">Error cargando notas</p>';
    }
}

export async function addProjectNote(projectId) {
    const input = document.getElementById(`pnInput-${projectId}`);
    if (!input || !input.value.trim()) return;

    await fetch(`${API}/api/project-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, content: input.value.trim() }),
    });
    input.value = '';
    loadProjectNotes(projectId);
}

export async function deleteProjectNote(noteId, projectId) {
    await fetch(`${API}/api/project-notes/${noteId}`, { method: 'DELETE' });
    loadProjectNotes(projectId);
}

// ── Project Tasks ───────────────────────────────────

export async function toggleProjectTasks(projectId) {
    const panel = document.getElementById(`projTasks-${projectId}`);
    if (!panel) return;
    const isHidden = panel.style.display === 'none';
    panel.style.display = isHidden ? 'block' : 'none';
    if (isHidden) loadProjectTasks(projectId);
}

export async function loadProjectTasks(projectId) {
    const list = document.getElementById(`ptList-${projectId}`);
    if (!list) return;

    try {
        const res = await fetch(`${API}/api/projects/${projectId}`);
        const project = await res.json();
        const tasks = project.tasks || [];

        if (!tasks.length) {
            list.innerHTML = '<p class="text-muted" style="font-size:0.75rem; padding:4px 0;">Sin tareas a\u00fan</p>';
            return;
        }

        // Show pending first, then done
        const sorted = [...tasks].sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0));
        list.innerHTML = sorted.map(t => {
            const deadlineTag = t.deadline ? `<span class="pt-deadline">\u{1F4C5} ${t.deadline}</span>` : '';
            const textEsc = t.text.replace(/'/g, '&#39;');
            if (t.done) {
                return `<div class="pn-item" style="opacity:0.45">
                <span style="margin-right:6px;">\u2705</span>
                <span class="pn-text" style="text-decoration:line-through;">${t.text}</span>
                ${deadlineTag}
                <button class="pn-del" onclick="toggleProjectTask('${t.id}', false, '${projectId}', '${textEsc}')" title="Reactivar">\u{1F504}</button>
                <button class="pn-del" onclick="deleteProjectTask('${t.id}', '${projectId}')">\u2716</button>
            </div>`;
            }
            return `<div class="pn-item">
            <button class="pn-del" onclick="toggleProjectTask('${t.id}', true, '${projectId}', '${textEsc}')" style="color:var(--text-muted);margin-right:6px;">\u2B1C</button>
            <span class="pn-text" style="cursor:pointer;" onclick="editProjectTask('${t.id}', '${projectId}')" title="Click para editar">${t.text}</span>
            ${deadlineTag}
            <button class="pn-del" onclick="editProjectTask('${t.id}', '${projectId}')" title="Editar">\u270E</button>
            <button class="pn-del" onclick="deleteProjectTask('${t.id}', '${projectId}')">\u2716</button>
        </div>`;
        }).join('');
    } catch {
        list.innerHTML = '<p class="text-muted" style="font-size:0.75rem;">Error cargando tareas</p>';
    }
}

export async function addProjectTask(projectId) {
    const input = document.getElementById(`ptInput-${projectId}`);
    const deadlineInput = document.getElementById(`ptDeadline-${projectId}`);
    if (!input || !input.value.trim()) return;

    const body = { text: input.value.trim(), project_id: projectId };
    if (deadlineInput?.value) body.deadline = deadlineInput.value;

    await fetch(`${API}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    input.value = '';
    if (deadlineInput) deadlineInput.value = '';
    loadProjectTasks(projectId);
}

export async function toggleProjectTask(taskId, done, projectId, taskText) {
    await fetch(`${API}/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done }),
    });
    // Register in completed history when completing
    if (done) {
        Storage.addCompleted({ text: taskText || 'Task', created_at: new Date().toISOString() }, 'task');
    }
    await Storage.refresh();
    loadProjectTasks(projectId);
}

export async function editProjectTask(taskId, projectId) {
    const list = document.getElementById(`ptList-${projectId}`);
    if (!list) return;

    const res = await fetch(`${API}/api/projects/${projectId}`);
    const project = await res.json();
    const task = (project.tasks || []).find(t => t.id === taskId);
    if (!task) return;

    const escaped = task.text.replace(/"/g, '&quot;');
    const item = list.querySelector(`[data-task-id="${taskId}"]`) ||
        [...list.querySelectorAll('.pn-item')].find(el => el.querySelector(`[onclick*="${taskId}"]`));
    if (!item) return;

    item.innerHTML = `
        <input type="text" class="pn-input" id="ptEdit-${taskId}" value="${escaped}" style="flex:1;" onkeydown="if(event.key==='Enter') saveProjectTaskEdit('${taskId}', '${projectId}'); if(event.key==='Escape') loadProjectTasks('${projectId}');">
        <input type="date" class="pn-input" id="ptEditDeadline-${taskId}" value="${task.deadline || ''}" style="width:120px; font-size:0.7rem;">
        <button class="pn-add-btn" onclick="saveProjectTaskEdit('${taskId}', '${projectId}')">OK</button>
    `;
    const input = document.getElementById(`ptEdit-${taskId}`);
    if (input) { input.focus(); input.select(); }
}

export async function saveProjectTaskEdit(taskId, projectId) {
    const input = document.getElementById(`ptEdit-${taskId}`);
    const deadlineInput = document.getElementById(`ptEditDeadline-${taskId}`);
    if (!input || !input.value.trim()) return;

    const body = { text: input.value.trim() };
    body.deadline = deadlineInput?.value || null;

    await fetch(`${API}/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    loadProjectTasks(projectId);
}

export async function deleteProjectTask(taskId, projectId) {
    await fetch(`${API}/api/tasks/${taskId}`, { method: 'DELETE' });
    loadProjectTasks(projectId);
}
