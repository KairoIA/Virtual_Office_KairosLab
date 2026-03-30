/**
 * KAIROS Search Module
 * Global search across journal, reminders, tasks, projects, inbox, and notes
 */

import { Storage }      from './storage.js';
import { jumpToDate }   from './calendar.js';

const API = window.KAIROS_API_URL || 'https://www.kairoslaboffice.trade';

// Cache notes so we don't fetch on every keystroke
let notesCache = null;
let notesFetchPromise = null;

function fetchNotes() {
    if (notesCache !== null) return Promise.resolve(notesCache);
    if (notesFetchPromise) return notesFetchPromise;
    notesFetchPromise = fetch(`${API}/api/notes`)
        .then(r => r.ok ? r.json() : [])
        .then(data => { notesCache = Array.isArray(data) ? data : []; return notesCache; })
        .catch(() => { notesCache = []; return notesCache; });
    return notesFetchPromise;
}

export function initSearch() {
    const input = document.getElementById('searchInput');
    if (!input) return;

    input.addEventListener('keyup', handleSearch);
    input.addEventListener('focus', handleSearch);

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-wrapper')) {
            document.getElementById('searchResults').style.display = 'none';
        }
    });

    // Pre-fetch notes on init
    fetchNotes();
}

async function handleSearch() {
    const q   = document.getElementById('searchInput').value.toLowerCase();
    const box = document.getElementById('searchResults');
    if (!q) { box.style.display = 'none'; return; }

    const journal   = Storage.getJournal();
    const reminders = Storage.getReminders();
    const tasks     = Storage.getTasks();
    const projects  = Storage.getProjects();
    const inbox     = Storage.getInbox();
    const results   = [];

    // Search journal entries
    for (const [key, value] of Object.entries(journal)) {
        const div = document.createElement('div');
        div.innerHTML = value;
        const text = div.innerText;
        if (text.toLowerCase().includes(q)) {
            results.push({
                type: '\uD83D\uDCD3 JOURNAL',
                date: key,
                text,
                action: () => {
                    window.switchToView('journal');
                    setTimeout(() => window.selectJournalDate(key), 300);
                },
            });
        }
    }

    // Search reminders
    reminders.forEach(x => {
        if (x.text.toLowerCase().includes(q)) {
            const fn = x.dueDate ? () => jumpToDate(x.dueDate) : () => window.switchToView('tasksview');
            results.push({ type: '\uD83D\uDD14 REMINDER', date: x.dueDate || '--', text: x.text, action: fn });
        }
    });

    // Search tasks
    tasks.forEach(x => {
        if (x.text.toLowerCase().includes(q)) {
            results.push({ type: '\uD83D\uDCCB TASK', date: 'Backlog', text: x.text, action: () => window.switchToView('tasksview') });
        }
    });

    // Search projects (name, objective, notes)
    projects.forEach(p => {
        const searchable = [p.name || '', p.objective || '', p.notes || '', p.next_action || ''].join(' ').toLowerCase();
        if (searchable.includes(q)) {
            results.push({
                type: '\uD83D\uDCBC PROJECT',
                date: p.status || '--',
                text: p.name + (p.objective ? ' — ' + p.objective : ''),
                action: () => window.switchToView('projects'),
            });
        }
    });

    // Search inbox items (text field)
    inbox.forEach(item => {
        const text = (item.text || '').toLowerCase();
        if (text.includes(q)) {
            results.push({
                type: '\uD83D\uDCE5 INBOX',
                date: item.created_at ? item.created_at.split('T')[0] : '--',
                text: item.text,
                action: () => window.switchToView('inbox'),
            });
        }
    });

    // Search notes (fetched from API)
    try {
        const notes = await fetchNotes();
        notes.forEach(n => {
            const text = (n.text || n.content || '').toLowerCase();
            if (text.includes(q)) {
                results.push({
                    type: '\uD83D\uDDD2 NOTE',
                    date: n.created_at ? n.created_at.split('T')[0] : '--',
                    text: n.text || n.content || '',
                    action: () => window.switchToView('hq'),
                });
            }
        });
    } catch {
        // Notes fetch failed, skip silently
    }

    box.innerHTML = '';
    if (results.length > 0) {
        box.style.display = 'block';
        results.forEach(r => {
            const item = document.createElement('div');
            item.className = 'search-item';
            item.innerHTML = `
                <div class="search-meta" style="color:var(--accent)">${r.type} // ${r.date}</div>
                <div class="search-match">${r.text}</div>
            `;
            item.onclick = () => {
                r.action();
                box.style.display = 'none';
            };
            box.appendChild(item);
        });
    } else {
        box.style.display = 'block';
        box.innerHTML = '<div style="padding:15px;color:#999;text-align:center">Sin resultados</div>';
    }
}
