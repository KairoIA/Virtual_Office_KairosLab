/**
 * KAIROS Calendar Module
 * Month navigation, day rendering, today highlight
 */

import { Storage } from './storage.js';

let currentYear, currentMonth;

export function initCalendar() {
    const today = new Date();
    currentYear  = today.getFullYear();
    currentMonth = today.getMonth();
    syncMonthInput();
    renderCalendar();
}

export function getCurrentDate() {
    return { year: currentYear, month: currentMonth };
}

export function changeMonth(offset) {
    const grid = document.getElementById('calendarGrid');
    const outClass = offset > 0 ? 'slide-out-left' : 'slide-out-right';
    const inClass  = offset > 0 ? 'slide-in-right'  : 'slide-in-left';

    grid.classList.add('animating', outClass);

    setTimeout(() => {
        let nm = currentMonth + offset;
        let ny = currentYear;
        if (nm > 11) { nm = 0; ny++; }
        else if (nm < 0) { nm = 11; ny--; }
        currentMonth = nm;
        currentYear  = ny;
        syncMonthInput();
        renderCalendar();
        grid.classList.remove(outClass);
        grid.classList.add(inClass);
        void grid.offsetWidth; // force reflow
        grid.classList.remove(inClass);
    }, 300);
}

export function navigateFromInput() {
    const val = document.getElementById('navMonth').value;
    if (!val) return;
    const [y, m] = val.split('-');
    currentYear  = parseInt(y);
    currentMonth = parseInt(m) - 1;
    const grid = document.getElementById('calendarGrid');
    grid.style.opacity = 0;
    setTimeout(() => { renderCalendar(); grid.style.opacity = 1; }, 200);
}

export function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    grid.innerHTML = '';

    const first = new Date(currentYear, currentMonth, 1);
    const last  = new Date(currentYear, currentMonth + 1, 0);
    let startDay = first.getDay() - 1;
    if (startDay === -1) startDay = 6; // Monday-first

    const today     = new Date();
    const entries   = Storage.getJournal();
    const reminders = Storage.getReminders();
    const completed = Storage.getCompleted();

    // Empty cells before first day
    for (let i = 0; i < startDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'day-card';
        Object.assign(empty.style, { opacity: 0, cursor: 'default', border: 'none', background: 'transparent', boxShadow: 'none' });
        grid.appendChild(empty);
    }

    for (let d = 1; d <= last.getDate(); d++) {
        const k = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

        // Plain text preview
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = entries[k] || '';
        const plainText = tempDiv.textContent || '';

        const remsToday = reminders.filter(t => t.dueDate === k && !t.done);
        const doneToday = completed.filter(t => t.date === k);
        const isToday = (d === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear());

        const card = document.createElement('div');
        card.className = `day-card ${entries[k] ? 'has-log' : ''} ${isToday ? 'is-today' : ''}`;
        card.dataset.dateKey = k;
        card.dataset.day = d;

        let indicators = '';
        let tooltipText = '';

        if (remsToday.length > 0) {
            indicators += '<span class="warning-icon">\u26A0\uFE0F</span>';
            tooltipText += `<strong>\u26A0\uFE0F DEADLINE:</strong><br>${remsToday.map(t => '\u2022 ' + t.text).join('<br>')}<br>`;
        }
        if (doneToday.length > 0) {
            indicators += '<span class="success-icon">\u2705</span>';
            tooltipText += `<strong>\u2705 COMPLETED:</strong><br>${doneToday.map(t => '\u2022 ' + t.text).join('<br>')}`;
        }

        const tooltip = tooltipText ? `<div class="tooltip-popup">${tooltipText}</div>` : '';

        card.innerHTML = `
            ${tooltip}
            <div class="day-top">
                <div class="number-group"><span class="day-number">${d}</span> ${indicators}</div>
                <div class="dot-log"></div>
            </div>
            <div class="preview">${plainText}</div>
        `;

        grid.appendChild(card);
    }
}

export function jumpToDate(dateStr) {
    const [y, m] = dateStr.split('-');
    currentYear  = parseInt(y);
    currentMonth = parseInt(m) - 1;
    syncMonthInput();
    renderCalendar();
}

function syncMonthInput() {
    const input = document.getElementById('navMonth');
    if (input) input.value = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
}
