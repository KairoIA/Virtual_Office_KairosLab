/**
 * Smoke Test — Quick health check of all API endpoints
 * Run: node backend/smoke-test.js
 * Returns exit code 0 if all pass, 1 if any fail
 */

const BASE = process.env.KAIROS_TEST_URL || 'http://localhost:3001';
const API_KEY = process.env.API_SECRET || '';
const AUTH_HEADERS = API_KEY ? { 'x-api-key': API_KEY } : {};

const endpoints = [
    { method: 'GET',  path: '/api/tasks',        name: 'Tasks' },
    { method: 'GET',  path: '/api/reminders',     name: 'Reminders' },
    { method: 'GET',  path: '/api/projects',      name: 'Projects' },
    { method: 'GET',  path: '/api/journal',       name: 'Journal' },
    { method: 'GET',  path: '/api/completed',     name: 'Completed' },
    { method: 'GET',  path: '/api/inbox',         name: 'Inbox' },
    { method: 'GET',  path: '/api/day-sessions',  name: 'Day Sessions' },
    { method: 'GET',  path: '/api/notes',         name: 'Notes' },
    { method: 'GET',  path: '/api/lists',         name: 'Lists' },
    { method: 'GET',  path: '/api/content',       name: 'Content' },
    { method: 'GET',  path: '/api/activity',      name: 'Activity' },
    { method: 'GET',  path: '/api/expenses',      name: 'Expenses' },
    { method: 'GET',  path: '/api/memory',        name: 'Memory' },
];

async function run() {
    console.log(`\n🧪 Smoke Test — ${BASE}\n`);
    let passed = 0;
    let failed = 0;

    for (const ep of endpoints) {
        try {
            const res = await fetch(`${BASE}${ep.path}`, { headers: AUTH_HEADERS });
            if (res.ok) {
                console.log(`  ✅ ${ep.name} (${ep.path}) — ${res.status}`);
                passed++;
            } else {
                console.log(`  ❌ ${ep.name} (${ep.path}) — ${res.status}`);
                failed++;
            }
        } catch (err) {
            console.log(`  ❌ ${ep.name} (${ep.path}) — ${err.message}`);
            failed++;
        }
    }

    // Test POST + DELETE cycle on tasks (create then cleanup)
    try {
        const createRes = await fetch(`${BASE}/api/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...AUTH_HEADERS },
            body: JSON.stringify({ text: '__smoke_test__' }),
        });
        const task = await createRes.json();
        if (task?.id) {
            await fetch(`${BASE}/api/tasks/${task.id}`, { method: 'DELETE', headers: AUTH_HEADERS });
            console.log(`  ✅ Tasks CRUD (POST+DELETE) — OK`);
            passed++;
        } else {
            console.log(`  ❌ Tasks CRUD — no id returned`);
            failed++;
        }
    } catch (err) {
        console.log(`  ❌ Tasks CRUD — ${err.message}`);
        failed++;
    }

    console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);
    process.exit(failed > 0 ? 1 : 0);
}

run();
