/**
 * KAIROS Lists View Module
 * Shows all lists (shopping, packing, custom) with CRUD
 */

const API = window.KAIROS_API_URL || 'https://www.kairoslaboffice.trade';

export function initListsView() {
    // Bind add-list button
    const btn = document.getElementById('btnAddList');
    if (btn) btn.addEventListener('click', promptNewList);
}

export async function renderListsView() {
    const el = document.getElementById('listsViewContent');
    if (!el) return;

    try {
        const res = await fetch(`${API}/api/lists`);
        const lists = await res.json();

        if (!Array.isArray(lists) || !lists.length) {
            el.innerHTML = '<div class="inbox-empty"><p>\uD83D\uDCDD No hay listas. D\u00edle a Kaira que cree una!</p></div>';
            return;
        }

        let html = '';
        lists.forEach(list => {
            const items = list.list_items || [];
            const sorted = items.sort((a, b) => a.position - b.position);
            const pending = sorted.filter(i => !i.done).length;
            const total = sorted.length;

            html += `<div class="list-card">
                <div class="list-card-header">
                    <h3 class="list-card-title">\uD83D\uDCCB ${escHtml(list.name)}</h3>
                    <span class="list-card-count">${pending}/${total}</span>
                    <button class="tv-btn tv-delete" onclick="deleteList('${list.id}')" title="Borrar lista">\u2716</button>
                </div>
                <div class="list-card-items">`;

            sorted.forEach(item => {
                html += `<div class="list-item ${item.done ? 'list-item-done' : ''}">
                    <button class="list-check" onclick="toggleListItem('${item.id}', ${!item.done})">${item.done ? '\u2705' : '\u2B1C'}</button>
                    <span class="list-item-text">${escHtml(item.text)}</span>
                    <button class="list-remove" onclick="removeListItem('${item.id}')">\u2716</button>
                </div>`;
            });

            html += `</div>
                <div class="list-add-row">
                    <input type="text" class="list-add-input" id="listInput-${list.id}" placeholder="A\u00f1adir item..." onkeydown="if(event.key==='Enter') addListItem('${list.id}')">
                    <button class="list-add-btn" onclick="addListItem('${list.id}')">+</button>
                </div>
            </div>`;
        });

        el.innerHTML = html;
    } catch (err) {
        el.innerHTML = '<div class="inbox-empty"><p>Error cargando listas</p></div>';
    }
}

async function promptNewList() {
    const name = prompt('Nombre de la nueva lista:');
    if (!name || !name.trim()) return;
    await fetch(`${API}/api/lists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() })
    });
    renderListsView();
}

export async function toggleListItem(itemId, done) {
    await fetch(`${API}/api/lists/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done })
    });
    renderListsView();
}

export async function removeListItem(itemId) {
    await fetch(`${API}/api/lists/items/${itemId}`, { method: 'DELETE' });
    renderListsView();
}

export async function addListItem(listId) {
    const input = document.getElementById(`listInput-${listId}`);
    if (!input || !input.value.trim()) return;
    await fetch(`${API}/api/lists/${listId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input.value.trim() })
    });
    input.value = '';
    renderListsView();
}

export async function deleteList(listId) {
    if (!confirm('\u00bfBorrar esta lista y todos sus items?')) return;
    await fetch(`${API}/api/lists/${listId}`, { method: 'DELETE' });
    renderListsView();
}

function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
