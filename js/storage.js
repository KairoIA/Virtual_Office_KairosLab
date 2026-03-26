/**
 * KAIROS Storage Layer
 * Abstraction over localStorage — will be swapped to Supabase in Phase 2
 * All data access goes through here so the rest of the app never touches storage directly
 */

const DB_KEYS = {
    JOURNAL:   'kairos_journal_v11',
    REMINDERS: 'kairos_reminders_v11',
    GENERAL:   'kairos_tasks_v11',
    COMPLETED: 'kairos_completed_v1',
};

const Storage = {

    // ── Journal ──────────────────────────────────────────
    getJournal() {
        return JSON.parse(localStorage.getItem(DB_KEYS.JOURNAL) || '{}');
    },

    getJournalEntry(dateKey) {
        return this.getJournal()[dateKey] || '';
    },

    saveJournalEntry(dateKey, htmlContent) {
        const entries = this.getJournal();
        if (!htmlContent || htmlContent === '<br>') {
            delete entries[dateKey];
        } else {
            entries[dateKey] = htmlContent;
        }
        localStorage.setItem(DB_KEYS.JOURNAL, JSON.stringify(entries));
    },

    // ── Reminders ────────────────────────────────────────
    getReminders() {
        return JSON.parse(localStorage.getItem(DB_KEYS.REMINDERS) || '[]');
    },

    saveReminders(list) {
        localStorage.setItem(DB_KEYS.REMINDERS, JSON.stringify(list));
    },

    addReminder(text, dueDate) {
        const list = this.getReminders();
        list.push({ text, dueDate, done: false });
        this.saveReminders(list);
        return list;
    },

    // ── General Tasks ────────────────────────────────────
    getTasks() {
        return JSON.parse(localStorage.getItem(DB_KEYS.GENERAL) || '[]');
    },

    saveTasks(list) {
        localStorage.setItem(DB_KEYS.GENERAL, JSON.stringify(list));
    },

    addTask(text) {
        const list = this.getTasks();
        list.push({ text, done: false, createdAt: new Date().toISOString() });
        this.saveTasks(list);
        return list;
    },

    // ── Completed History ────────────────────────────────
    getCompleted() {
        return JSON.parse(localStorage.getItem(DB_KEYS.COMPLETED) || '[]');
    },

    saveCompleted(list) {
        localStorage.setItem(DB_KEYS.COMPLETED, JSON.stringify(list));
    },

    addCompleted(item, type) {
        const history = this.getCompleted();
        let durationStr = '';
        if (type === 'task' && item.createdAt) {
            const days = Math.floor((Date.now() - new Date(item.createdAt).getTime()) / 86400000);
            durationStr = `${days} days`;
        }
        history.push({
            text: item.text,
            date: new Date().toISOString().split('T')[0],
            type: type === 'reminder' ? 'Reminder' : 'Task',
            duration: durationStr,
        });
        this.saveCompleted(history);
    },

    removeItem(dbKey, index) {
        const key = dbKey === 'reminders' ? DB_KEYS.REMINDERS : DB_KEYS.GENERAL;
        const list = JSON.parse(localStorage.getItem(key) || '[]');
        const removed = list.splice(index, 1)[0];
        localStorage.setItem(key, JSON.stringify(list));
        return removed;
    },

    reorderItem(dbKey, fromIndex, toIndex) {
        const key = dbKey === 'reminders' ? DB_KEYS.REMINDERS : DB_KEYS.GENERAL;
        const list = JSON.parse(localStorage.getItem(key) || '[]');
        const item = list.splice(fromIndex, 1)[0];
        list.splice(toIndex, 0, item);
        localStorage.setItem(key, JSON.stringify(list));
    },

    updateItemText(dbKey, index, newText) {
        const key = dbKey === 'reminders' ? DB_KEYS.REMINDERS : DB_KEYS.GENERAL;
        const list = JSON.parse(localStorage.getItem(key) || '[]');
        if (list[index]) {
            list[index].text = newText;
            localStorage.setItem(key, JSON.stringify(list));
        }
    },

    // ── Export / Import ──────────────────────────────────
    exportAll() {
        return {
            j: localStorage.getItem(DB_KEYS.JOURNAL),
            r: localStorage.getItem(DB_KEYS.REMINDERS),
            g: localStorage.getItem(DB_KEYS.GENERAL),
            c: localStorage.getItem(DB_KEYS.COMPLETED),
        };
    },

    importAll(data) {
        if (data.j) localStorage.setItem(DB_KEYS.JOURNAL, data.j);
        if (data.r) localStorage.setItem(DB_KEYS.REMINDERS, data.r);
        if (data.g) localStorage.setItem(DB_KEYS.GENERAL, data.g);
        if (data.c) localStorage.setItem(DB_KEYS.COMPLETED, data.c);
    },
};

export { Storage, DB_KEYS };
