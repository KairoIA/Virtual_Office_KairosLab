/**
 * KAIROS Stats Module V2
 * Real analytics: weekly trend, domain hours, plan ratio, streak, slot performance
 */

import { Storage } from './storage.js';

const API = window.KAIROS_API_URL || 'https://www.kairoslaboffice.trade';

const DOMAIN_COLORS = {
    Trading: '#22c55e', Dev: '#58a6ff', Bets: '#d29922',
    IA: '#a371f7', Personal: '#8b949e', Estudio: '#00f2ff', General: '#6e7681',
};

export function initStats() {}

export async function renderStats() {
    const grid = document.getElementById('statsGrid');
    const charts = document.getElementById('statsCharts');
    const breakdown = document.getElementById('statsBreakdown');
    if (!grid) return;

    // Fetch aggregated stats from backend
    let stats = null;
    try {
        const res = await fetch(`${API}/api/stats`);
        stats = await res.json();
    } catch {
        grid.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:30px;">Error loading stats</p>';
        return;
    }

    // Also fetch token usage
    let tokenUsage = { input: 0, output: 0, requests: 0, cost_usd: 0, since: '-' };
    try { tokenUsage = await fetch(`${API}/api/voice/usage`).then(r => r.ok ? r.json() : tokenUsage); } catch {}

    // === STAT CARDS ===
    const dp = stats.dayPlanRatio;
    const planPct = dp.total > 0 ? Math.round((dp.done / dp.total) * 100) : 0;
    const deltaSign = stats.weekComparison.delta >= 0 ? '+' : '';
    const deltaColor = stats.weekComparison.delta >= 0 ? 'var(--success)' : 'var(--danger)';

    const cards = [
        { label: 'Completados (7d)', value: stats.weekComparison.thisWeek, color: 'var(--success)', icon: '&#9989;', sub: `<span style="color:${deltaColor}">${deltaSign}${stats.weekComparison.delta}%</span> vs semana anterior` },
        { label: 'Streak', value: `${stats.streak}d`, color: stats.streak >= 7 ? '#f0c040' : 'var(--accent)', icon: '&#128293;', sub: 'dias consecutivos completando' },
        { label: 'Day Plan Ratio', value: `${planPct}%`, color: planPct >= 70 ? 'var(--success)' : planPct >= 40 ? 'var(--warning)' : 'var(--danger)', icon: '&#127919;', sub: `${dp.done}/${dp.total} items esta semana` },
        { label: 'Tasks Pendientes', value: stats.pendingTasks, color: stats.pendingTasks > 20 ? 'var(--danger)' : 'var(--accent)', icon: '&#128203;' },
        { label: 'Proyectos Activos', value: stats.projectSummary.active, color: 'var(--highlight)', icon: '&#128188;', sub: `${stats.projectSummary.permanent}&#9854; ${stats.projectSummary.temporal}&#127919; | ${stats.projectSummary.done} done` },
        { label: 'Kaira AI', value: `$${tokenUsage.cost_usd.toFixed(3)}`, color: '#c9a84c', icon: '&#129302;', sub: `${tokenUsage.requests} msgs | ${((tokenUsage.input + tokenUsage.output) / 1000).toFixed(1)}K tok` },
    ];

    grid.innerHTML = cards.map(c => `
        <div class="stat-card">
            <div class="stat-card-icon" style="color:${c.color}; text-shadow: 0 0 10px ${c.color};">${c.icon}</div>
            <div class="stat-card-value" style="color:${c.color};">${c.value}</div>
            <div class="stat-card-label">${c.label}</div>
            ${c.sub ? `<div class="stat-card-sub">${c.sub}</div>` : ''}
        </div>
    `).join('');

    // === CHARTS ===
    let chartsHtml = '';

    // 1. Weekly trend (completed per day, last 7 days)
    const days = Object.entries(stats.completedByDay);
    const maxDay = Math.max(...days.map(d => d[1]), 1);
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    chartsHtml += `
        <div class="stats-chart-card">
            <div class="stats-section-title">COMPLETADOS POR DIA (7d)</div>
            <div class="stats-bar-chart">
                ${days.map(([date, count]) => {
                    const d = new Date(date);
                    const label = dayLabels[d.getDay()];
                    const height = Math.max((count / maxDay) * 100, 4);
                    const isToday = date === new Date().toISOString().split('T')[0];
                    return `<div class="stats-bar-col">
                        <div class="stats-bar-value">${count}</div>
                        <div class="stats-bar-vertical" style="height:${height}%;${isToday ? 'background:var(--highlight);box-shadow:0 0 8px var(--highlight);' : ''}"></div>
                        <div class="stats-bar-day${isToday ? ' stats-bar-today' : ''}">${label}</div>
                    </div>`;
                }).join('')}
            </div>
        </div>
    `;

    // 2. Domain hours (horizontal bars)
    const domains = Object.entries(stats.domainHours).sort((a, b) => b[1] - a[1]);
    const maxHours = domains.length > 0 ? domains[0][1] : 1;

    if (domains.length > 0) {
        chartsHtml += `
            <div class="stats-chart-card">
                <div class="stats-section-title">HORAS POR DOMINIO (7d)</div>
                <div class="stats-bars">
                    ${domains.map(([domain, hours]) => `
                        <div class="stats-bar-row">
                            <span class="stats-bar-label" style="color:${DOMAIN_COLORS[domain] || '#8b949e'}">${domain}</span>
                            <div class="stats-bar-track">
                                <div class="stats-bar-fill" style="width:${(hours / maxHours * 100).toFixed(0)}%;background:${DOMAIN_COLORS[domain] || '#8b949e'}"></div>
                            </div>
                            <span class="stats-bar-count">${hours.toFixed(1)}h</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // 3. Slot performance (4 blocks)
    const slotLabels = { morning: '🌅 Morning', afternoon: '☀️ Afternoon', evening: '🌆 Evening', night: '🌙 Night' };
    chartsHtml += `
        <div class="stats-chart-card">
            <div class="stats-section-title">RENDIMIENTO POR BLOQUE (7d)</div>
            <div class="stats-slots">
                ${Object.entries(stats.slotStats).map(([slot, s]) => {
                    const pct = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
                    const color = pct >= 70 ? 'var(--success)' : pct >= 40 ? 'var(--warning)' : 'var(--danger)';
                    return `<div class="stats-slot-card">
                        <div class="stats-slot-label">${slotLabels[slot]}</div>
                        <div class="stats-slot-pct" style="color:${color}">${pct}%</div>
                        <div class="stats-slot-detail">${s.done}/${s.total}</div>
                    </div>`;
                }).join('')}
            </div>
        </div>
    `;

    charts.innerHTML = chartsHtml;

    // === BREAKDOWN ===
    let breakdownHtml = '';

    // Tasks by category
    const cats = Object.entries(stats.tasksByCategory).sort((a, b) => b[1] - a[1]);
    const maxCat = cats.length > 0 ? cats[0][1] : 1;
    if (cats.length > 0) {
        breakdownHtml += `
            <div class="stats-section-title">TASKS PENDIENTES POR CATEGORIA</div>
            <div class="stats-bars">
                ${cats.map(([cat, count]) => `
                    <div class="stats-bar-row">
                        <span class="stats-bar-label" style="color:${DOMAIN_COLORS[cat] || '#8b949e'}">${cat}</span>
                        <div class="stats-bar-track">
                            <div class="stats-bar-fill" style="width:${(count / maxCat * 100).toFixed(0)}%;background:${DOMAIN_COLORS[cat] || '#8b949e'}"></div>
                        </div>
                        <span class="stats-bar-count">${count}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // Projects by status
    const ps = stats.projectSummary;
    const statuses = [
        ['active', ps.active, 'var(--success)'],
        ['paused', ps.paused, 'var(--warning)'],
        ['blocked', ps.blocked, 'var(--danger)'],
        ['done', ps.done, 'var(--text-muted)'],
    ].filter(s => s[1] > 0);
    const maxStatus = Math.max(...statuses.map(s => s[1]), 1);

    if (statuses.length > 0) {
        breakdownHtml += `
            <div class="stats-section-title" style="margin-top:25px;">PROYECTOS POR ESTADO</div>
            <div class="stats-bars">
                ${statuses.map(([status, count, color]) => `
                    <div class="stats-bar-row">
                        <span class="stats-bar-label">${status.toUpperCase()}</span>
                        <div class="stats-bar-track">
                            <div class="stats-bar-fill" style="width:${(count / maxStatus * 100).toFixed(0)}%;background:${color}"></div>
                        </div>
                        <span class="stats-bar-count">${count}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    breakdown.innerHTML = breakdownHtml;
}
