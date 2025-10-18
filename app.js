// app.js — frontend JS for Extrol (Auth + Entries CRUD)
const API_BASE = 'https://extrol-api-production.up.railway.app'; // API hosted on Railway

// DOM
const topActions = id('topActions');
const authArea = id('authArea');
const dashboard = id('dashboard');
const entriesWrap = id('entries');
const totalSpentEl = id('totalSpent');
const avgPriceEl = id('avgPrice');
const lastRefillEl = id('lastRefill');
const countEntriesEl = id('countEntries');
const modalBackdrop = id('modalBackdrop');
const modalTitle = id('modalTitle');
const modalDate = id('modalDate');
const modalPrice = id('modalPrice');
const modalNote = id('modalNote');
const modalSave = id('modalSave');
const modalCancel = id('modalCancel');
const searchInput = id('search');
const sortBy = id('sortBy');
const btnAdd = id('btnAdd');
const toast = id('toast');

let state = { entries: [], editingId: null, user: null, token: null };

// --- helpers ---
function id(n) { return document.getElementById(n) }
function showToast(text, time = 2500) { toast.textContent = text; toast.hidden = false; setTimeout(() => toast.hidden = true, time) }
function formatCurrency(v) { return '₹' + Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function authHeaders() { return state.token ? { 'Authorization': 'Bearer ' + state.token } : {} }
function api(path, opts = {}) { const url = API_BASE + path; opts.headers = opts.headers || {}; Object.assign(opts.headers, { 'Content-Type': 'application/json' }, authHeaders()); return fetch(url, opts) }

// --- modal UI ---
function showAddModal() {
    modalBackdrop.style.display = 'flex';
    modalTitle.textContent = 'Add Entry';
    modalDate.value = new Date().toISOString().split('T')[0];
    modalPrice.value = '';
    modalNote.value = '';
    state.editingId = null;
}

function hideModal() {
    modalBackdrop.style.display = 'none';
    state.editingId = null;
}

// Event listeners for modal
if (btnAdd) btnAdd.addEventListener('click', showAddModal);

function injectFabStyles() {
  if (document.getElementById('fabStyle')) return;
  const style = document.createElement('style');
  style.id = 'fabStyle';
  style.textContent = `
    @media (max-width: 480px) {
      #btnAdd { display: none !important; }
      .fab {
        position: fixed;
        bottom: calc(18px + env(safe-area-inset-bottom));
        right: 18px;
        width: 56px; height: 56px;
        border-radius: 50%; padding: 0;
        display: inline-flex; align-items: center; justify-content: center;
        font-size: 0; z-index: 1100;
        box-shadow: 0 10px 24px rgba(0,0,0,0.45);
      }
      .fab::after { content: '+'; font-size: 32px; color: #fff; line-height: 1; }
    }`;
  document.head.appendChild(style);
}

function setupFab() {
  const isMobile = window.matchMedia('(max-width: 480px)').matches;
  let fab = document.getElementById('fabAdd');
  if (isMobile) {
    injectFabStyles();
    if (!fab) {
      fab = document.createElement('button');
      fab.id = 'fabAdd';
      fab.className = 'btn primary fab';
      fab.setAttribute('aria-label', 'Add Entry');
      document.body.appendChild(fab);
      fab.addEventListener('click', showAddModal);
    }
  } else {
    if (fab) fab.remove();
  }
}

function injectCardStyles() {
  if (document.getElementById('cardsStyle')) return;
  const style = document.createElement('style');
  style.id = 'cardsStyle';
  style.textContent = `
    .entry { position: relative; display: grid !important; grid-template-columns: 1fr auto !important; grid-template-rows: auto auto !important; grid-template-areas: 'content .' 'footer footer' !important; gap: 8px !important; align-items: start !important; }
    .entry-content { grid-area: content !important; display: flex !important; flex-direction: column !important; gap: 6px !important; }
    .entry-price { font-weight: 800 !important; text-align: left !important; }
    .entry-note { color: var(--muted) !important; }
    .entry-footer { grid-area: footer !important; display: flex !important; justify-content: flex-end !important; }
    .entry-menu-toggle { position: absolute; top: 8px; right: 8px; background: transparent; border: none; color: var(--muted); cursor: pointer; padding: 6px; border-radius: 8px; }
    .entry-menu-toggle:hover { background: rgba(255,255,255,0.08); color: #fff; }
    .entry-menu { position: absolute; top: 36px; right: 8px; background: var(--glass); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.4); display: none; flex-direction: column; min-width: 120px; z-index: 900; }
    .entry-menu.open { display: flex; }
    .entry-menu .menu-item { background: transparent; border: none; color: #fff; text-align: left; padding: 8px 12px; cursor: pointer; }
    .entry-menu .menu-item:hover { background: rgba(255,255,255,0.08); }
  `;
  document.head.appendChild(style);
}

setupFab();
window.addEventListener('resize', setupFab);
modalCancel.addEventListener('click', hideModal);

function setAuth(data) {
    state.user = data.user;
    state.token = data.token;
    localStorage.setItem('extrol_token', data.token);
    localStorage.setItem('extrol_user', JSON.stringify(data.user));
    renderTopbar();
}

// --- topbar ---
function renderTopbar() {
    topActions.innerHTML = '';
    const token = localStorage.getItem('extrol_token');
    if (!token) {
        // Links are now directly in HTML
    } else {
        state.token = token;
        state.user = JSON.parse(localStorage.getItem('extrol_user') || '{}');
        const span = document.createElement('div'); 
        span.className = 'user-name';
        span.textContent = state.user.name || state.user.email;
        const out = el('button', 'btn', 'Logout'); out.addEventListener('click', logout);
        topActions.appendChild(span); topActions.appendChild(out);
    }
}

// small helper to create element quickly
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e }

// --- load after login ---
async function loadAfterAuth() {
    if (authArea) authArea.hidden = true;
    if (dashboard) dashboard.hidden = false;
    renderTopbar();
    await loadEntries();
}

// --- auth actions ---
function logout() {
    // Clear local storage
    localStorage.removeItem('extrol_token');
    localStorage.removeItem('extrol_user');

    // Reset local state
    state = { entries: [], editingId: null, user: null, token: null };

    // Re-render UI
    renderTopbar();
    dashboard.hidden = true;
    // authArea.hidden = false;

    // Redirect to home page
    window.location.href = '/Extrol/';
}
  

// --- entries CRUD ---
async function loadEntries() {
    try {
        const res = await api('/api/entries');
        const data = await res.json();
        if (!res.ok) { 
            showToast(data.error || 'Failed to load entries'); 
            if (res.status === 401) { logout(); } 
            return; 
        }
        state.entries = Array.isArray(data) ? data : [];
        renderEntries();
    } catch (e) { showToast('Network error loading entries') }
}

function renderEntries() {
    // stats
    const total = state.entries.reduce((s, e) => s + (e.price || 0), 0);
    totalSpentEl.textContent = formatCurrency(total);
    countEntriesEl.textContent = state.entries.length;
    avgPriceEl.textContent = state.entries.length ? formatCurrency(total / state.entries.length) : '—';
    lastRefillEl.textContent = state.entries.length ? state.entries.slice().sort((a, b) => b.date.localeCompare(a.date))[0].date : '—';

    // entries list
    entriesWrap.innerHTML = '';
    const q = (searchInput.value || '').trim().toLowerCase();
    let list = state.entries.slice();
    // search
    if (q) list = list.filter(x => (x.note || '').toLowerCase().includes(q) || x.date.includes(q));
    // sort
    const s = sortBy.value;
    if (s === 'date_desc') list.sort((a, b) => b.date.localeCompare(a.date));
    if (s === 'date_asc') list.sort((a, b) => a.date.localeCompare(b.date));
    if (s === 'price_desc') list.sort((a, b) => b.price - a.price);
    if (s === 'price_asc') list.sort((a, b) => a.price - b.price);

    list.forEach(it => {
        const card = document.createElement('div');
        card.className = 'entry';
        card.dataset.id = it._id || it.id;

        // main parts
        const note = document.createElement('div');
        note.className = 'entry-note';
        note.textContent = (it.note || '').trim();

        const price = document.createElement('div');
        price.className = 'entry-price';
        price.textContent = formatCurrency(it.price);

        const footer = document.createElement('div');
        footer.className = 'entry-footer';
        const dateEl = document.createElement('div');
        dateEl.className = 'entry-date';
        dateEl.textContent = it.date;
        footer.appendChild(dateEl);

        // menu toggle + menu
        const toggle = document.createElement('button');
        toggle.className = 'entry-menu-toggle';
        toggle.setAttribute('aria-label', 'More actions');
        toggle.textContent = '⋮';

        const menu = document.createElement('div');
        menu.className = 'entry-menu';
        const edit = document.createElement('button');
        edit.className = 'menu-item';
        edit.textContent = 'Edit';
        edit.addEventListener('click', (e) => { e.stopPropagation(); openEditModal(it); menu.classList.remove('open'); });
        const del = document.createElement('button');
        del.className = 'menu-item';
        del.textContent = 'Delete';
        del.addEventListener('click', (e) => { e.stopPropagation(); deleteEntry(it); menu.classList.remove('open'); });
        menu.appendChild(edit); menu.appendChild(del);

        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.entry-menu.open').forEach(el => { if (el !== menu) el.classList.remove('open'); });
            menu.classList.toggle('open');
        });

        // close menus when clicking outside
        card.addEventListener('click', () => menu.classList.remove('open'));

        // compose card
        const content = document.createElement('div');
        content.className = 'entry-content';
        content.appendChild(price);
        content.appendChild(note);
        card.appendChild(content);
        card.appendChild(toggle);
        card.appendChild(menu);
        card.appendChild(footer);
        entriesWrap.appendChild(card);
    });
}

function escapeHtml(s) { return (s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// add/edit modal (handlers registered above)
// consolidated: btnAdd -> showAddModal, modalCancel -> hideModal

function openEditModal(it) {
    state.editingId = it._id || it.id;
    modalTitle.textContent = 'Edit Entry';
    modalDate.value = it.date;
    modalPrice.value = it.price;
    modalNote.value = it.note || '';
    modalBackdrop.style.display = 'flex';
}

modalSave.addEventListener('click', async () => {
    const d = modalDate.value || new Date().toISOString().slice(0, 10);
    const p = parseFloat(modalPrice.value || 0);
    const n = modalNote.value || '';
    if (!p || p <= 0) { showToast('Enter a valid price'); return; }
    try {
        if (state.editingId) {
            // update
            const res = await api('/api/entries/' + state.editingId, { method: 'PUT', body: JSON.stringify({ date: d, price: p, note: n }) });
            const data = await res.json();
            if (!res.ok) { showToast(data.error || 'Update failed'); return; }
            showToast('Entry updated successfully');
        } else {
            const res = await api('/api/entries', { method: 'POST', body: JSON.stringify({ date: d, price: p, note: n }) });
            const data = await res.json();
            if (!res.ok) { showToast(data.error || 'Save failed'); return; }
            showToast('Entry added successfully');
        }
        hideModal();
        await loadEntries();
    } catch (e) { showToast('Network error saving entry'); }
});

async function deleteEntry(it) {
    if (!confirm('Delete this entry?')) return;
    try {
        const id = it._id || it.id;
        const res = await api('/api/entries/' + id, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) { showToast(data.error || 'Delete failed'); return; }
        showToast('Entry deleted successfully'); await loadEntries();
    } catch (e) { showToast('Network error deleting entry'); }
}

// event binds
searchInput.addEventListener('input', renderEntries);
sortBy.addEventListener('change', renderEntries);

// startup
(function init() {
    const token = localStorage.getItem('extrol_token');
    const user = localStorage.getItem('extrol_user');
    const prefetch = localStorage.getItem('extrol_prefetch_entries');

    renderTopbar();
    injectCardStyles();

    if (token && user) {
        state.token = token;
        state.user = JSON.parse(user);
        if (prefetch) {
            try { state.entries = JSON.parse(prefetch); } catch {}
            localStorage.removeItem('extrol_prefetch_entries');
            if (dashboard) dashboard.hidden = false;
            renderEntries();
            // Refresh from API in background
            loadEntries();
        } else {
            loadAfterAuth();
        }
    }
})();
