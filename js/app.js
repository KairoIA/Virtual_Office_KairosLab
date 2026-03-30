/**
 * KAIROS Lab — Virtual Office V2
 * Main entry point — orchestrates all modules + navigation
 */

import { initMarketCanvas }  from './canvas.js';
import { initCalendar, changeMonth, navigateFromInput, renderCalendar, jumpToDate } from './calendar.js';
import { initJournal, openJournal, saveJournalEntry, closeJournal, execCmd, applyColor, removeColor, toggleToolbarMenu } from './journal.js';
import { initTasks, addReminder, addGenTask, toggleHistoryModal, deleteHistoryItem, toggleIconMenu } from './tasks.js';
import { renderReminders, renderGenTasks } from './tasks.js';
import { initSearch }         from './search.js';
import { Storage }            from './storage.js';
import { connectVoice, sendTextMessage, toggleRecording, toggleRecordingVoice, toggleRecordingText, setOnDataChanged } from './assistant.js';
import { initHQ, renderHQ, toggleSessionDone, clearSession } from './hq.js';
import { initProjects, renderProjects, openProjectModal, closeProjectModal, saveProjectFromModal, editProject, toggleProjectStatus, completeProject, deleteProject, toggleProjectNotes, addProjectNote, deleteProjectNote, toggleProjectTasks, loadProjectTasks, addProjectTask, toggleProjectTask, editProjectTask, saveProjectTaskEdit, deleteProjectTask } from './projects.js';
import { initInbox, renderInbox, captureToInbox, processInboxItem, deleteInboxItem } from './inbox.js';
import { initLibrary, renderLibrary, markLibraryReviewed, deleteLibraryItem } from './library.js';
import { initStats, renderStats } from './stats.js';
import { initJournalTab, renderJournalTab, saveJournalFromTab, deleteJournal, selectJournalDate, editJournalEntry, deleteJournalEntry } from './journalTab.js';
import { initSwipe }              from './swipe.js';
import { initTasksView, renderTasksView } from './tasksView.js';
import { initListsView, renderListsView, toggleListItem, removeListItem, addListItem, deleteList } from './listsView.js';
import { openDayDetail, closeDayDetail, dayDetailComplete, dayDetailDelete, dayDetailEdit } from './dayDetail.js';

// ── Navigation ───────────────────────────────────────────
let currentView = 'hq';
const TAB_ORDER = ['hq', 'projects', 'tasksview', 'listsview', 'calendar', 'inbox', 'library', 'journal', 'stats'];
let isAnimating = false;

function switchView(viewId, direction = null) {
    if (viewId === currentView || isAnimating) return;

    const oldView = document.getElementById(`view-${currentView}`);
    const newView = document.getElementById(`view-${viewId}`);

    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    const tab = document.querySelector(`.nav-tab[data-view="${viewId}"]`);
    if (tab) tab.classList.add('active');

    // Determine slide direction
    if (!direction) {
        const oldIdx = TAB_ORDER.indexOf(currentView);
        const newIdx = TAB_ORDER.indexOf(viewId);
        direction = newIdx > oldIdx ? 'left' : 'right';
    }

    currentView = viewId;

    // If no old view or same, just show
    if (!oldView || !newView) {
        document.querySelectorAll('.view').forEach(v => {
            v.classList.remove('active', 'slide-in-left', 'slide-in-right', 'slide-out-left', 'slide-out-right');
        });
        if (newView) newView.classList.add('active');
        refreshView(viewId);
        return;
    }

    isAnimating = true;

    // Slide out old
    const outClass = direction === 'left' ? 'slide-out-left' : 'slide-out-right';
    const inClass = direction === 'left' ? 'slide-in-right' : 'slide-in-left';

    oldView.classList.remove('active');
    oldView.classList.add(outClass);

    // Slide in new
    newView.classList.add(inClass);

    setTimeout(() => {
        oldView.classList.remove(outClass);
        newView.classList.remove(inClass);
        newView.classList.add('active');
        isAnimating = false;
        refreshView(viewId);
    }, 250);
}

function refreshView(viewId) {
    if (viewId === 'hq') renderHQ();
    else if (viewId === 'projects') renderProjects();
    else if (viewId === 'tasksview') renderTasksView();
    else if (viewId === 'listsview') renderListsView();
    else if (viewId === 'calendar') renderCalendar();
    else if (viewId === 'inbox') renderInbox();
    else if (viewId === 'library') renderLibrary();
    else if (viewId === 'stats') renderStats();
    else if (viewId === 'journal') renderJournalTab();
}

// ── Boot ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    initMarketCanvas();

    await Storage.init();

    // Init all modules
    initCalendar();
    initJournal();
    initTasks();
    initSearch();
    initHQ();
    initProjects();
    initInbox();
    initLibrary();
    initStats();
    initJournalTab();
    initTasksView();
    initListsView();
    connectVoice();

    // Swipe gesture navigation
    const tabOrder = ['hq', 'projects', 'tasksview', 'listsview', 'calendar', 'inbox', 'library', 'journal', 'stats'];
    initSwipe(tabOrder, switchView, changeMonth);

    // Navigation tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => switchView(tab.dataset.view));
    });

    // When Kaira modifies data, refresh current view
    setOnDataChanged(async () => {
        await Storage.refresh();
        renderHQ();
        renderCalendar();
        renderReminders();
        renderGenTasks();
        renderProjects();
        renderInbox();
        renderLibrary();
        renderStats();
        renderJournalTab();
        renderTasksView();
        renderListsView();
    });

    // Register PWA service worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
});

// ── Calendar day clicks ──────────────────────────────────
document.addEventListener('click', (e) => {
    const card = e.target.closest('.day-card[data-date-key]');
    if (card) openDayDetail(card.dataset.dateKey);
});

// ── History delete ───────────────────────────────────────
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.del-hist-btn');
    if (btn && btn.dataset.histIdx !== undefined) deleteHistoryItem(parseInt(btn.dataset.histIdx));
});

// ── Export / Import ──────────────────────────────────────
window.exportData = function () {
    const data = Storage.exportAll();
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
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
        } catch { alert('Error al leer el archivo.'); }
    };
    if (input.files[0]) reader.readAsText(input.files[0]);
};

// ── Expose to HTML inline handlers ──────────────────────
// Navigation
window.switchToView       = switchView;

// Calendar
window.changeMonth        = changeMonth;
window.navigateCalendar   = navigateFromInput;

// Tasks
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

// Day Detail
window.closeDayDetail       = closeDayDetail;
window.dayDetailComplete    = dayDetailComplete;
window.dayDetailDelete      = dayDetailDelete;
window.dayDetailEdit        = dayDetailEdit;

// Close day detail modal on overlay background click
document.addEventListener('click', (e) => {
    if (e.target.id === 'dayDetailModal') closeDayDetail();
});

// HQ
window.toggleSessionDone = toggleSessionDone;
window.clearSession    = clearSession;

// Projects
window.openProjectModal     = openProjectModal;
window.closeProjectModal    = closeProjectModal;
window.saveProjectFromModal = saveProjectFromModal;
window.editProject          = editProject;
window.toggleProjectStatus  = toggleProjectStatus;
window.completeProject      = completeProject;
window.deleteProject        = deleteProject;
window.toggleProjectNotes   = toggleProjectNotes;
window.addProjectNote       = addProjectNote;
window.deleteProjectNote    = deleteProjectNote;
window.toggleProjectTasks   = toggleProjectTasks;
window.loadProjectTasks     = loadProjectTasks;
window.addProjectTask       = addProjectTask;
window.toggleProjectTask    = toggleProjectTask;
window.editProjectTask      = editProjectTask;
window.saveProjectTaskEdit  = saveProjectTaskEdit;
window.deleteProjectTask    = deleteProjectTask;

// Inbox
window.captureToInbox    = captureToInbox;
window.processInboxItem  = processInboxItem;
window.deleteInboxItem   = deleteInboxItem;

// Library
window.markLibraryReviewed = markLibraryReviewed;
window.deleteLibraryItem   = deleteLibraryItem;

// Lists
window.toggleListItem    = toggleListItem;
window.removeListItem    = removeListItem;
window.addListItem       = addListItem;
window.deleteList        = deleteList;

// Journal Tab
window.saveJournalFromTab    = saveJournalFromTab;
window.deleteJournalFromTab  = deleteJournal;
window.selectJournalDate     = selectJournalDate;
window.editJournalEntry      = editJournalEntry;
window.deleteJournalEntry    = deleteJournalEntry;

// Assistant
window.toggleAssistant = function () {
    const panel = document.getElementById('assistantPanel');
    const fab   = document.getElementById('assistantFab');
    panel.classList.toggle('open');
    fab.classList.toggle('hidden');
};
window.handleSend = function () {
    const input = document.getElementById('chatInput');
    if (input.value.trim()) {
        sendTextMessage(input.value.trim());
        input.value = '';
    }
};
window.handleMic = function () {
    toggleRecording();
};
window.handleMicVoice = function () {
    toggleRecordingVoice();
};
window.handleMicText = function () {
    toggleRecordingText();
};


