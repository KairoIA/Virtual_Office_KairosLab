/**
 * KAIROS Storage Layer — V2
 * Reads/writes to backend API (Supabase) with local cache
 * Now includes: journal, reminders, tasks, completed, projects, inbox, top3
 */

const API = window.KAIROS_API_URL || 'https://www.kairoslaboffice.trade';

let cache = {
    journal: {},
    reminders: [],
    tasks: [],
    completed: [],
    projects: [],
    inbox: [],
    top3: [],
    loaded: false,
};

const Storage = {

    // ── Init — fetch everything from API ─────────────────
    async init() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const [journal, reminders, tasks, completed, projects, inbox, top3] = await Promise.all([
                apiFetch('/api/journal'),
                apiFetch('/api/reminders'),
                apiFetch('/api/tasks'),
                apiFetch('/api/completed'),
                apiFetch('/api/projects'),
                apiFetch('/api/inbox'),
                apiFetch(`/api/top3?date=${today}`),
            ]);
            cache.journal = journal || {};
            cache.reminders = (reminders || []).map(normalizeReminder);
            cache.tasks = (tasks || []).map(normalizeTask);
            cache.completed = (completed || []).map(normalizeCompleted);
            cache.projects = projects || [];
            cache.inbox = inbox || [];
            cache.top3 = top3 || [];
            cache.loaded = true;
            console.log('[Storage] Loaded from API (V2)');
        } catch (err) {
            console.warn('[Storage] API unreachable, using localStorage fallback');
            cache.journal = JSON.parse(localStorage.getItem('kairos_journal_v11') || '{}');
            cache.reminders = JSON.parse(localStorage.getItem('kairos_reminders_v11') || '[]');
            cache.tasks = JSON.parse(localStorage.getItem('kairos_tasks_v11') || '[]');
            cache.completed = JSON.parse(localStorage.getItem('kairos_completed_v1') || '[]');
            cache.projects = [];
            cache.inbox = [];
            cache.top3 = [];
            cache.loaded = true;
        }
    },

    // ── Journal ──────────────────────────────────────────
    getJournal() { return cache.journal; },
    getJournalEntry(dateKey) { return cache.journal[dateKey] || ''; },
    saveJournalEntry(dateKey, htmlContent) {
        if (!htmlContent || htmlContent === '<br>') {
            delete cache.journal[dateKey];
        } else {
            cache.journal[dateKey] = htmlContent;
        }
        apiPut(`/api/journal/${dateKey}`, { content: htmlContent || '' });
    },

    // ── Reminders ────────────────────────────────────────
    getReminders() { return cache.reminders; },
    addReminder(text, dueDate) {
        const item = { text, dueDate: dueDate || '', done: false };
        cache.reminders.push(item);
        apiPost('/api/reminders', { text, due_date: dueDate || null }).then(data => {
            if (data?.id) { item.id = data.id; item.created_at = data.created_at; }
        });
        return cache.reminders;
    },
    saveReminders(list) { cache.reminders = list; },

    // ── General Tasks ────────────────────────────────────
    getTasks() { return cache.tasks; },
    addTask(text) {
        const item = { text, done: false, createdAt: new Date().toISOString() };
        cache.tasks.push(item);
        apiPost('/api/tasks', { text }).then(data => {
            if (data?.id) { item.id = data.id; item.created_at = data.created_at; }
        });
        return cache.tasks;
    },
    saveTasks(list) { cache.tasks = list; },

    // ── Completed History ────────────────────────────────
    getCompleted() { return cache.completed; },
    saveCompleted(list) { cache.completed = list; },
    addCompleted(item, type) {
        let durationStr = '';
        if (type === 'task' && (item.createdAt || item.created_at)) {
            const created = item.createdAt || item.created_at;
            const days = Math.floor((Date.now() - new Date(created).getTime()) / 86400000);
            durationStr = `${days} days`;
        }
        const entry = {
            text: item.text,
            date: new Date().toISOString().split('T')[0],
            type: type === 'reminder' ? 'Reminder' : 'Task',
            duration: durationStr,
        };
        cache.completed.push(entry);
        apiPost('/api/completed', { text: item.text, type: entry.type, duration: durationStr });
    },

    // ── Projects ─────────────────────────────────────────
    getProjects() { return cache.projects; },
    async addProject(project) {
        const data = await apiPost('/api/projects', project);
        if (data?.id) cache.projects.push(data);
        return data;
    },
    async updateProject(id, update) {
        const data = await apiPut(`/api/projects/${id}`, update);
        const idx = cache.projects.findIndex(p => p.id === id);
        if (idx >= 0 && data) Object.assign(cache.projects[idx], data);
        return data;
    },
    async deleteProject(id) {
        await apiDelete(`/api/projects/${id}`);
        cache.projects = cache.projects.filter(p => p.id !== id);
    },

    // ── Inbox ────────────────────────────────────────────
    getInbox() { return cache.inbox; },
    async addToInbox(text) {
        const data = await apiPost('/api/inbox', { text });
        if (data?.id) cache.inbox.unshift(data);
        return data;
    },
    async processInboxItem(id) {
        await apiPut(`/api/inbox/${id}`, { processed: true });
        const item = cache.inbox.find(i => i.id === id);
        if (item) item.processed = true;
    },
    async deleteInboxItem(id) {
        await apiDelete(`/api/inbox/${id}`);
        cache.inbox = cache.inbox.filter(i => i.id !== id);
    },

    // ── Top 3 ────────────────────────────────────────────
    getTop3() { return cache.top3; },
    async setTop3(slot, text, energy) {
        const today = new Date().toISOString().split('T')[0];
        const data = await apiPost('/api/top3', { date: today, slot, text, energy: energy || 'quick' });
        if (data?.id) {
            const idx = cache.top3.findIndex(t => t.slot === slot);
            if (idx >= 0) cache.top3[idx] = data;
            else cache.top3.push(data);
        }
        return data;
    },
    async toggleTop3(id, done) {
        const data = await apiPut(`/api/top3/${id}`, { done });
        const item = cache.top3.find(t => t.id === id);
        if (item) item.done = done;
        return data;
    },

    // ── Remove / Reorder / Update ────────────────────────
    removeItem(dbKey, index) {
        const isReminder = dbKey === 'reminders';
        const list = isReminder ? cache.reminders : cache.tasks;
        const removed = list.splice(index, 1)[0];
        if (removed?.id) {
            const endpoint = isReminder ? '/api/reminders' : '/api/tasks';
            apiDelete(`${endpoint}/${removed.id}`);
        }
        return removed;
    },
    reorderItem(dbKey, fromIndex, toIndex) {
        const list = dbKey === 'reminders' ? cache.reminders : cache.tasks;
        const item = list.splice(fromIndex, 1)[0];
        list.splice(toIndex, 0, item);
    },
    updateItemText(dbKey, index, newText) {
        const isReminder = dbKey === 'reminders';
        const list = isReminder ? cache.reminders : cache.tasks;
        if (list[index]) {
            list[index].text = newText;
            if (list[index].id) {
                const endpoint = isReminder ? '/api/reminders' : '/api/tasks';
                apiPut(`${endpoint}/${list[index].id}`, { text: newText });
            }
        }
    },

    // ── Export / Import ──────────────────────────────────
    exportAll() {
        return {
            j: JSON.stringify(cache.journal),
            r: JSON.stringify(cache.reminders),
            g: JSON.stringify(cache.tasks),
            c: JSON.stringify(cache.completed),
        };
    },
    importAll(data) {
        if (data.j) cache.journal = JSON.parse(data.j);
        if (data.r) cache.reminders = JSON.parse(data.r);
        if (data.g) cache.tasks = JSON.parse(data.g);
        if (data.c) cache.completed = JSON.parse(data.c);
        apiPost('/api/import', {
            journal: cache.journal, reminders: cache.reminders,
            tasks: cache.tasks, completed: cache.completed,
        });
    },

    async refresh() { await this.init(); },
};

// ── Normalize ────────────────────────────────────────
function normalizeReminder(r) {
    return { id: r.id, text: r.text, dueDate: r.due_date || '', done: r.done || false, created_at: r.created_at, project_id: r.project_id, category: r.category || null, priority: r.priority || null };
}
function normalizeTask(t) {
    return { id: t.id, text: t.text, done: t.done || false, deadline: t.deadline || null, category: t.category || null, priority: t.priority || null, createdAt: t.created_at, created_at: t.created_at, project_id: t.project_id };
}
function normalizeCompleted(c) {
    return { id: c.id, text: c.text, date: c.completed_date || c.date, type: c.type, duration: c.duration || '' };
}

// ── API Helpers ──────────────────────────────────────
async function apiFetch(path) {
    const res = await fetch(`${API}${path}`);
    if (!res.ok) throw new Error(`API ${res.status}`);
    return res.json();
}
async function apiPost(path, body) {
    try {
        const res = await fetch(`${API}${path}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        return res.json();
    } catch (err) { console.warn('[Storage] API POST failed:', err.message); }
}
async function apiPut(path, body) {
    try {
        const res = await fetch(`${API}${path}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        return res.json();
    } catch (err) { console.warn('[Storage] API PUT failed:', err.message); }
}
async function apiDelete(path) {
    try { await fetch(`${API}${path}`, { method: 'DELETE' }); }
    catch (err) { console.warn('[Storage] API DELETE failed:', err.message); }
}

const DB_KEYS = {
    JOURNAL: 'kairos_journal_v11',
    REMINDERS: 'kairos_reminders_v11',
    GENERAL: 'kairos_tasks_v11',
    COMPLETED: 'kairos_completed_v1',
};

export { Storage, DB_KEYS };
