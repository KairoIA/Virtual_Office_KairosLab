/**
 * KAIROS Journal Module
 * Rich-text day log editor with toolbar
 */

import { Storage }        from './storage.js';
import { renderCalendar }  from './calendar.js';

const ICONS = ['\uD83D\uDCC8', '\uD83E\uDDEA', '\uD83D\uDCCA', '\uD83D\uDCBC', '\uD83E\uDDE0', '\uD83D\uDCBB', '\uD83D\uDCB5', '\u2705\uFE0F', '\uD83D\uDD0D', '\u26A1', '\uD83D\uDCCB', '\uD83D\uDCC5', '\uD83C\uDFAF', '\uD83D\uDCA1', '\u2699\uFE0F'];
let selectedDateKey = null;

export function initJournal() {
    initToolbarIcons();
    setupGlobalClicks();
}

export function openJournal(day, dateKey) {
    selectedDateKey = dateKey;
    const reminders = Storage.getReminders();
    const completed = Storage.getCompleted();

    document.getElementById('modalTitle').innerText = `LOG: ${dateKey}`;
    document.getElementById('journalInput').innerHTML = Storage.getJournalEntry(dateKey);

    // Deadlines for this day
    const todayRem = reminders.filter(t => t.dueDate === dateKey && !t.done);
    const areaRem  = document.getElementById('modalTasksArea');
    const listRem  = document.getElementById('modalTasksList');
    listRem.innerHTML = '';
    if (todayRem.length > 0) {
        areaRem.style.display = 'block';
        todayRem.forEach(t => {
            const d = document.createElement('div');
            d.innerHTML = `\u2022 ${t.text}`;
            listRem.appendChild(d);
        });
    } else {
        areaRem.style.display = 'none';
    }

    // Completed for this day
    const todayDone = completed.filter(t => t.date === dateKey);
    const areaDone  = document.getElementById('modalCompletedArea');
    const listDone  = document.getElementById('modalCompletedList');
    listDone.innerHTML = '';
    if (todayDone.length > 0) {
        areaDone.style.display = 'block';
        todayDone.forEach(t => {
            const d = document.createElement('div');
            d.innerHTML = `\u2022 ${t.text}`;
            listDone.appendChild(d);
        });
    } else {
        areaDone.style.display = 'none';
    }

    document.getElementById('journalModal').style.display = 'flex';
}

export function saveJournalEntry() {
    const content = document.getElementById('journalInput').innerHTML;
    Storage.saveJournalEntry(selectedDateKey, content);
    closeJournal();
    renderCalendar();
}

export function closeJournal() {
    document.getElementById('journalModal').style.display = 'none';
}

// ── Rich-text commands ───────────────────────────────────
export function execCmd(cmd, value = null) {
    document.execCommand(cmd, false, value);
    document.getElementById('journalInput').focus();
}

export function applyColor(hex) {
    document.execCommand('styleWithCSS', false, true);
    document.execCommand('hiliteColor', false, hex);
    document.execCommand('foreColor', false, '#000000');
}

export function removeColor() {
    document.execCommand('styleWithCSS', false, true);
    document.execCommand('hiliteColor', false, 'transparent');
    document.execCommand('foreColor', false, '#e6edf3');
}

export function toggleToolbarMenu(id) {
    const menu = document.getElementById(id);
    document.querySelectorAll('.toolbar-dropdown-content').forEach(e => {
        if (e.id !== id) e.classList.remove('show');
    });
    menu.classList.toggle('show');
}

// ── Internals ────────────────────────────────────────────
function initToolbarIcons() {
    const iconMenu = document.getElementById('iconMenu');
    if (!iconMenu) return;
    ICONS.forEach(icon => {
        const div = document.createElement('div');
        div.className = 'icon-option';
        div.innerText = icon;
        div.onmousedown = (e) => {
            e.preventDefault();
            document.getElementById('journalInput').focus();
            document.execCommand('insertText', false, icon + ' ');
        };
        iconMenu.appendChild(div);
    });
}

function setupGlobalClicks() {
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.toolbar-dropdown')) {
            document.querySelectorAll('.toolbar-dropdown-content').forEach(el => el.classList.remove('show'));
        }
    });
}
