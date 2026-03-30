/**
 * KAIROS Journal Tab Module
 * Full journal view with date selector, editor, and recent entries list
 */

import { Storage } from './storage.js';

const API = window.KAIROS_API_URL || 'https://www.kairoslaboffice.trade';

let currentDateKey = '';

export function initJournalTab() {
    const dateInput = document.getElementById('journalTabDate');
    if (!dateInput) return;

    // Default to today
    const today = new Date();
    currentDateKey = formatDateKey(today);
    dateInput.value = currentDateKey;

    dateInput.addEventListener('change', () => {
        currentDateKey = dateInput.value;
        loadJournalForDate(currentDateKey);
    });
}

export function renderJournalTab() {
    const dateInput = document.getElementById('journalTabDate');
    if (dateInput && !currentDateKey) {
        currentDateKey = formatDateKey(new Date());
        dateInput.value = currentDateKey;
    }
    loadJournalForDate(currentDateKey);
    loadRecentJournals();
}

function formatDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function getJournalType(content) {
    if (!content) return 'normal';
    if (content.startsWith('<!-- MONTHLY_REVIEW -->')) return 'monthly';
    if (content.startsWith('<!-- WEEKLY_REVIEW -->')) return 'weekly';
    // Also check if the prefix is inside appended content (weekly/monthly appended to existing entry)
    if (content.includes('<!-- MONTHLY_REVIEW -->')) return 'monthly';
    if (content.includes('<!-- WEEKLY_REVIEW -->')) return 'weekly';
    return 'normal';
}

function getJournalBadgeHTML(type) {
    if (type === 'weekly') {
        return `<span class="journal-type-badge journal-badge-weekly" style="display:inline-block;background:#2563eb;color:#fff;padding:2px 10px;border-radius:8px;font-size:0.78rem;margin-bottom:8px;">📊 Weekly Review</span>`;
    }
    if (type === 'monthly') {
        return `<span class="journal-type-badge journal-badge-monthly" style="display:inline-block;background:#7c3aed;color:#fff;padding:2px 10px;border-radius:8px;font-size:0.78rem;margin-bottom:8px;">📈 Monthly Review</span>`;
    }
    return '';
}

function getJournalIcon(type) {
    if (type === 'weekly') return '📊';
    if (type === 'monthly') return '📈';
    return '📓';
}

function loadJournalForDate(dateKey) {
    const editor = document.getElementById('journalTabEditor');
    if (!editor) return;

    const entries = Storage.getJournal();
    const content = entries[dateKey] || '';

    // Show badge above editor if it's a review entry
    const type = getJournalType(content);
    let badgeContainer = document.getElementById('journalTypeBadge');
    if (!badgeContainer) {
        // Create badge container above the editor
        badgeContainer = document.createElement('div');
        badgeContainer.id = 'journalTypeBadge';
        editor.parentNode.insertBefore(badgeContainer, editor);
    }
    badgeContainer.innerHTML = getJournalBadgeHTML(type);

    editor.innerHTML = content;
}

export async function saveJournalFromTab() {
    const editor = document.getElementById('journalTabEditor');
    if (!editor || !currentDateKey) return;

    const content = editor.innerHTML;

    try {
        const res = await fetch(`${API}/api/journal/${currentDateKey}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });
        if (!res.ok) throw new Error(`API ${res.status}`);

        // Update local cache
        Storage.saveJournalEntry(currentDateKey, content);

        // Visual feedback
        const btn = document.querySelector('.journal-btn-save');
        if (btn) {
            const original = btn.innerHTML;
            btn.innerHTML = '\u2705 Saved!';
            btn.style.background = 'var(--success)';
            setTimeout(() => { btn.innerHTML = original; btn.style.background = ''; }, 1500);
        }

        loadRecentJournals();
    } catch (err) {
        console.error('[JournalTab] Save failed:', err);
        alert('Error saving journal entry.');
    }
}

export async function deleteJournal() {
    if (!currentDateKey) return;
    if (!confirm(`Delete journal entry for ${currentDateKey}?`)) return;

    try {
        // Send empty content to trigger delete
        const res = await fetch(`${API}/api/journal/${currentDateKey}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: '' })
        });
        if (!res.ok) throw new Error(`API ${res.status}`);

        // Update local cache
        Storage.saveJournalEntry(currentDateKey, '');

        // Clear editor
        const editor = document.getElementById('journalTabEditor');
        if (editor) editor.innerHTML = '';

        loadRecentJournals();
    } catch (err) {
        console.error('[JournalTab] Delete failed:', err);
        alert('Error deleting journal entry.');
    }
}

export function loadRecentJournals() {
    const listEl = document.getElementById('journalRecentList');
    if (!listEl) return;

    const entries = Storage.getJournal();
    const dates = Object.keys(entries)
        .filter(k => entries[k] && entries[k] !== '<br>')
        .sort((a, b) => b.localeCompare(a))
        .slice(0, 10);

    if (dates.length === 0) {
        listEl.innerHTML = '<p class="text-muted" style="font-size:0.85rem;">No entries yet.</p>';
        return;
    }

    listEl.innerHTML = dates.map(dateKey => {
        const content = entries[dateKey];
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content;
        const preview = (tempDiv.textContent || '').substring(0, 60);
        const isActive = dateKey === currentDateKey ? ' active' : '';

        // Determine entry type
        const type = getJournalType(content);
        const icon = getJournalIcon(type);
        const badgeHTML = type === 'weekly'
            ? ' <span style="background:#2563eb;color:#fff;padding:1px 6px;border-radius:6px;font-size:0.7rem;">Weekly Review</span>'
            : type === 'monthly'
            ? ' <span style="background:#7c3aed;color:#fff;padding:1px 6px;border-radius:6px;font-size:0.7rem;">Monthly Review</span>'
            : '';

        // Format date nicely
        const [y, m, d] = dateKey.split('-');
        const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
        const dayName = dateObj.toLocaleDateString('en', { weekday: 'short' });
        const monthName = dateObj.toLocaleDateString('en', { month: 'short' });

        return `<div class="journal-recent-item${isActive}">
            <div class="journal-recent-top" onclick="selectJournalDate('${dateKey}')">
                <div class="journal-recent-date">${icon} ${dayName}, ${d} ${monthName} ${y}${badgeHTML}</div>
                <div class="journal-recent-preview">${preview}${preview.length >= 60 ? '...' : ''}</div>
            </div>
            <div class="journal-recent-actions">
                <button class="journal-item-btn journal-item-edit" onclick="editJournalEntry('${dateKey}')" title="Edit">&#9998;</button>
                <button class="journal-item-btn journal-item-delete" onclick="deleteJournalEntry('${dateKey}')" title="Delete">&#128465;</button>
            </div>
        </div>`;
    }).join('');
}

export function selectJournalDate(dateKey) {
    currentDateKey = dateKey;
    const dateInput = document.getElementById('journalTabDate');
    if (dateInput) dateInput.value = dateKey;
    loadJournalForDate(dateKey);
    loadRecentJournals(); // Re-render to update active state
}

export function editJournalEntry(dateKey) {
    // Navigate to that date in the editor
    selectJournalDate(dateKey);
    // Focus the editor
    const editor = document.getElementById('journalTabEditor');
    if (editor) editor.focus();
}

export async function deleteJournalEntry(dateKey) {
    if (!confirm(`Delete journal entry for ${dateKey}?`)) return;

    try {
        const res = await fetch(`${API}/api/journal/${dateKey}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: '' })
        });
        if (!res.ok) throw new Error(`API ${res.status}`);

        Storage.saveJournalEntry(dateKey, '');

        // If we just deleted the currently viewed entry, clear editor
        if (dateKey === currentDateKey) {
            const editor = document.getElementById('journalTabEditor');
            if (editor) editor.innerHTML = '';
        }

        loadRecentJournals();
    } catch (err) {
        console.error('[JournalTab] Delete failed:', err);
        alert('Error deleting journal entry.');
    }
}
