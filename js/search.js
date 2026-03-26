/**
 * KAIROS Search Module
 * Global search across journal, reminders, and tasks
 */

import { Storage }      from './storage.js';
import { jumpToDate }   from './calendar.js';
import { openJournal }  from './journal.js';
import { toggleSidePanel } from './tasks.js';

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
}

function handleSearch() {
    const q   = document.getElementById('searchInput').value.toLowerCase();
    const box = document.getElementById('searchResults');
    if (!q) { box.style.display = 'none'; return; }

    const journal   = Storage.getJournal();
    const reminders = Storage.getReminders();
    const tasks     = Storage.getTasks();
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
                    jumpToDate(key);
                    const day = parseInt(key.split('-')[2]);
                    openJournal(day, key);
                },
            });
        }
    }

    // Search reminders
    reminders.forEach(x => {
        if (x.text.toLowerCase().includes(q)) {
            const fn = x.dueDate ? () => jumpToDate(x.dueDate) : () => toggleSidePanel(true);
            results.push({ type: '\uD83D\uDD14 REMINDER', date: x.dueDate || '--', text: x.text, action: fn });
        }
    });

    // Search tasks
    tasks.forEach(x => {
        if (x.text.toLowerCase().includes(q)) {
            results.push({ type: '\uD83D\uDCCB TASK', date: 'Backlog', text: x.text, action: () => toggleSidePanel(true) });
        }
    });

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
