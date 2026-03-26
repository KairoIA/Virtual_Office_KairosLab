/**
 * KAIROS Lab — Virtual Office
 * Main entry point — orchestrates all modules
 */

import { initMarketCanvas }  from './canvas.js';
import { initCalendar, changeMonth, navigateFromInput, renderCalendar, jumpToDate } from './calendar.js';
import { initJournal, openJournal, saveJournalEntry, closeJournal, execCmd, applyColor, removeColor, toggleToolbarMenu } from './journal.js';
import { initTasks, addReminder, addGenTask, toggleSidePanel, toggleHistoryModal, deleteHistoryItem, toggleIconMenu } from './tasks.js';
import { initSearch }         from './search.js';
import { Storage }            from './storage.js';

// ── Boot ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initMarketCanvas();
    initCalendar();
    initJournal();
    initTasks();
    initSearch();
});

// ── Calendar day clicks (delegated) ─────────────────────
document.addEventListener('click', (e) => {
    const card = e.target.closest('.day-card[data-date-key]');
    if (card) {
        openJournal(parseInt(card.dataset.day), card.dataset.dateKey);
    }
});

// ── History delete (delegated) ──────────────────────────
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.del-hist-btn');
    if (btn && btn.dataset.histIdx !== undefined) {
        deleteHistoryItem(parseInt(btn.dataset.histIdx));
    }
});

// ── Export / Import ──────────────────────────────────────
window.exportData = function () {
    const data = Storage.exportAll();
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `KAIROS_BACKUP_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
};

window.importData = function (input) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            Storage.importAll(data);
            alert('Datos importados correctamente.');
            location.reload();
        } catch {
            alert('Error al leer el archivo.');
        }
    };
    if (input.files[0]) reader.readAsText(input.files[0]);
};

// ── Expose to HTML inline handlers ──────────────────────
// These bridge the gap between HTML onclick="" attributes and ES modules
window.changeMonth        = changeMonth;
window.navigateCalendar   = navigateFromInput;
window.toggleSidePanel    = toggleSidePanel;
window.toggleHistoryModal = toggleHistoryModal;
window.addReminder        = addReminder;
window.addGenTask         = addGenTask;
window.toggleIconMenu     = toggleIconMenu;

// Journal toolbar
window.execCmd            = execCmd;
window.applyColor         = applyColor;
window.removeColor        = removeColor;
window.toggleToolbarMenu  = toggleToolbarMenu;
window.saveJournalEntry   = saveJournalEntry;
window.closeJournal       = closeJournal;
