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

const DAY_NAMES_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const CAL_DOMAIN_COLORS = {
    Trading: '#22c55e', Dev: '#58a6ff', Bets: '#d29922',
    IA: '#a371f7', Personal: '#8b949e', General: '#8b949e',
    Estudio: '#00f2ff',
};

export function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    grid.innerHTML = '';

    // Day-of-week headers
    DAY_NAMES_SHORT.forEach(name => {
        const header = document.createElement('div');
        header.className = 'cal-day-header';
        header.textContent = name;
        grid.appendChild(header);
    });

    const first = new Date(currentYear, currentMonth, 1);
    const last  = new Date(currentYear, currentMonth + 1, 0);
    let startDay = first.getDay() - 1;
    if (startDay === -1) startDay = 6; // Monday-first

    const today     = new Date();
    const entries   = Storage.getJournal();
    const reminders = Storage.getReminders();
    const completed = Storage.getCompleted();
    const tasks     = Storage.getTasks();
    const projects  = Storage.getProjects();
    const projMap   = {};
    projects.forEach(p => { projMap[p.id] = p; });

    // Empty cells before first day
    for (let i = 0; i < startDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'day-card';
        Object.assign(empty.style, { opacity: 0, cursor: 'default', border: 'none', background: 'transparent', boxShadow: 'none' });
        grid.appendChild(empty);
    }

    for (let d = 1; d <= last.getDate(); d++) {
        const k = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

        // Day of week name
        const dateObj = new Date(currentYear, currentMonth, d);
        const dayName = DAY_NAMES_SHORT[(dateObj.getDay() + 6) % 7]; // Monday-first

        const remsToday = reminders.filter(t => t.dueDate === k && !t.done);
        const tasksToday = tasks.filter(t => t.deadline === k && !t.done);
        const doneToday = completed.filter(t => t.date === k);
        const hasJournal = !!entries[k];
        const isToday = (d === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear());

        const card = document.createElement('div');
        card.className = `day-card ${hasJournal ? 'has-log' : ''} ${isToday ? 'is-today' : ''}`;
        card.dataset.dateKey = k;
        card.dataset.day = d;

        // Build legend items — each pending item gets a mini line
        let legendHtml = '';
        const MAX_LEGEND = 5;
        let totalPending = remsToday.length + tasksToday.length;

        remsToday.forEach((r, i) => {
            if (i + tasksToday.length >= MAX_LEGEND && totalPending > MAX_LEGEND && i >= MAX_LEGEND - tasksToday.length) return;
            const cat = r.category || 'General';
            const color = CAL_DOMAIN_COLORS[cat] || '#8b949e';
            const proj = r.project_id && projMap[r.project_id] ? projMap[r.project_id].name : '';
            const prioIcon = r.priority === 'red' ? '\u{1F534}' : r.priority === 'yellow' ? '\u{1F7E1}' : '';
            legendHtml += `<div class="cal-legend-item" title="${r.text}">
                <span class="cal-legend-dot" style="background:${color}"></span>
                <span class="cal-legend-icon">\u{1F514}</span>
                <span class="cal-legend-text">${prioIcon}${r.text.substring(0, 22)}${r.text.length > 22 ? '..' : ''}</span>
                ${proj ? `<span class="cal-legend-proj">${proj.substring(0, 10)}</span>` : ''}
            </div>`;
        });

        tasksToday.forEach((t, i) => {
            if (remsToday.length + i >= MAX_LEGEND && totalPending > MAX_LEGEND) return;
            const cat = t.category || 'General';
            const color = (t.project_id && projMap[t.project_id]) ? CAL_DOMAIN_COLORS[projMap[t.project_id].domain] || '#8b949e' : CAL_DOMAIN_COLORS[cat] || '#8b949e';
            const proj = t.project_id && projMap[t.project_id] ? projMap[t.project_id].name : '';
            const prioIcon = t.priority === 'red' ? '\u{1F534}' : t.priority === 'yellow' ? '\u{1F7E1}' : '';
            legendHtml += `<div class="cal-legend-item" title="${t.text}">
                <span class="cal-legend-dot" style="background:${color}"></span>
                <span class="cal-legend-icon">\u{1F4CB}</span>
                <span class="cal-legend-text">${prioIcon}${t.text.substring(0, 22)}${t.text.length > 22 ? '..' : ''}</span>
                ${proj ? `<span class="cal-legend-proj">${proj.substring(0, 10)}</span>` : ''}
            </div>`;
        });

        if (totalPending > MAX_LEGEND) {
            legendHtml += `<div class="cal-legend-more">+${totalPending - MAX_LEGEND} more</div>`;
        }

        // Completed items (collapsed)
        if (doneToday.length > 0) {
            legendHtml += `<div class="cal-legend-item cal-legend-done" title="${doneToday.length} completed">
                <span class="cal-legend-icon">\u2705</span>
                <span class="cal-legend-text">${doneToday.length} completed</span>
            </div>`;
        }

        // Journal indicator
        if (hasJournal) {
            legendHtml += `<div class="cal-legend-item cal-legend-journal">
                <span class="cal-legend-icon">\u{1F4D3}</span>
                <span class="cal-legend-text">Journal</span>
            </div>`;
        }

        // Header indicators (compact, for the top line)
        let indicators = '';
        if (remsToday.length > 0) indicators += `<span class="cal-badge cal-badge-rem">${remsToday.length}R</span>`;
        if (tasksToday.length > 0) indicators += `<span class="cal-badge cal-badge-task">${tasksToday.length}T</span>`;
        if (doneToday.length > 0) indicators += `<span class="cal-badge cal-badge-done">${doneToday.length}\u2714</span>`;

        card.innerHTML = `
            <div class="day-top">
                <div class="number-group">
                    <span class="day-name">${dayName}</span>
                    <span class="day-number">${d}</span>
                    ${indicators}
                </div>
                ${hasJournal ? '<div class="dot-log"></div>' : ''}
            </div>
            <div class="cal-legend">${legendHtml || '<span class="cal-legend-empty">&mdash;</span>'}</div>
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
