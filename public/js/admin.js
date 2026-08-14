const USERS_API = '/api/auth/users';

if (window.requireRoles) {
  window.requireRoles(['admin']);
}

document.addEventListener('DOMContentLoaded', () => {
  if (!window.sessionReady) {
    return;
  }
  window.sessionReady
    .then((user) => {
      if (!user || user.role !== 'admin') {
        window.location.href = 'index.html';
        return;
      }
      initAdminPage();
    })
    .catch(() => {});
});

function initAdminPage() {
  const form = document.getElementById('create-user-form');
  if (form) {
    form.addEventListener('submit', handleCreateUser);
  }
  loadUsers();
  loadHealth();
  loadDrops();
  loadAlerts();
  loadIngestDrops();
  loadFinanceSummary();
  const mktDate = document.getElementById('mkt-date');
  if (mktDate) mktDate.value = new Date().toISOString().split('T')[0];
}

// ─── Drop management ────────────────────────────────────────────────────────

let _showArchived = false;
let _editingDropId = null;

async function loadDrops() {
  const tbody = document.getElementById('drops-tbody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-6 text-center text-slate-500 text-sm">Loading…</td></tr>`;
  try {
    const data = await fetch('/api/meta/drops?all=1', { credentials: 'include' }).then(r => r.json());
    const drops = (data.drops || []).filter(d => _showArchived || d.is_active);
    if (!drops.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-6 text-center text-slate-500 text-sm">No drops found.</td></tr>`;
      return;
    }
    tbody.innerHTML = drops.map(d => {
      const status = d.is_active
        ? `<span class="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full">Active</span>`
        : `<span class="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs font-semibold rounded-full">Archived</span>`;
      const launch = d.launch_date ? d.launch_date.split('T')[0] : '—';
      const archiveBtn = d.is_active
        ? `<button onclick="toggleDropActive(${d.drop_id}, false)" class="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50" title="Archive"><i class="fas fa-archive"></i></button>`
        : `<button onclick="toggleDropActive(${d.drop_id}, true)" class="text-xs text-emerald-600 hover:text-emerald-800 px-2 py-1 rounded hover:bg-emerald-50" title="Restore"><i class="fas fa-undo"></i></button>`;
      return `<tr>
        <td class="px-4 py-3">
          <p class="font-semibold">${escapeHtml(d.drop_name)}</p>
          ${d.description ? `<p class="text-xs text-slate-500">${escapeHtml(d.description)}</p>` : ''}
        </td>
        <td class="px-4 py-3 text-sm">${escapeHtml(d.season || '—')}</td>
        <td class="px-4 py-3 text-sm">${launch}</td>
        <td class="px-4 py-3">${status}</td>
        <td class="px-4 py-3 text-right flex items-center justify-end gap-1">
          <button onclick="openEditDropModal(${d.drop_id})" class="text-xs text-indigo-500 hover:text-indigo-700 px-2 py-1 rounded hover:bg-indigo-50" title="Edit"><i class="fas fa-pencil"></i></button>
          ${archiveBtn}
        </td>
      </tr>`;
    }).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-6 text-center text-rose-500 text-sm">Error loading drops.</td></tr>`;
  }
}

function toggleShowArchived() {
  _showArchived = !_showArchived;
  const btn = document.getElementById('show-archived-btn');
  if (btn) {
    btn.classList.toggle('bg-indigo-50', _showArchived);
    btn.classList.toggle('text-indigo-700', _showArchived);
    btn.innerHTML = _showArchived
      ? '<i class="fas fa-eye-slash"></i> Hide archived'
      : '<i class="fas fa-archive"></i> Show archived';
  }
  loadDrops();
}

let _allDrops = [];

function openNewDropModal() {
  _editingDropId = null;
  document.getElementById('drop-modal-title').textContent = 'New drop';
  document.getElementById('dm-submit').textContent = 'Create drop';
  document.getElementById('dm-name').value = '';
  document.getElementById('dm-season').value = '';
  document.getElementById('dm-launch').value = '';
  document.getElementById('dm-desc').value = '';
  document.getElementById('dm-error').classList.add('hidden');
  document.getElementById('drop-modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('dm-name').focus(), 50);
}

async function openEditDropModal(dropId) {
  _editingDropId = dropId;
  document.getElementById('drop-modal-title').textContent = 'Edit drop';
  document.getElementById('dm-submit').textContent = 'Save changes';
  document.getElementById('dm-error').classList.add('hidden');
  try {
    const data = await fetch('/api/meta/drops?all=1', { credentials: 'include' }).then(r => r.json());
    const d = (data.drops || []).find(x => x.drop_id === dropId);
    if (!d) return;
    document.getElementById('dm-name').value = d.drop_name || '';
    document.getElementById('dm-season').value = d.season || '';
    document.getElementById('dm-launch').value = d.launch_date ? d.launch_date.split('T')[0] : '';
    document.getElementById('dm-desc').value = d.description || '';
  } catch (_) {}
  document.getElementById('drop-modal').classList.remove('hidden');
}

function closeDropModal() {
  document.getElementById('drop-modal').classList.add('hidden');
}

async function submitDropModal() {
  const name = document.getElementById('dm-name').value.trim();
  const errEl = document.getElementById('dm-error');
  if (!name) { errEl.textContent = 'Drop name is required.'; errEl.classList.remove('hidden'); return; }
  errEl.classList.add('hidden');

  const body = {
    drop_name: name,
    season: document.getElementById('dm-season').value.trim() || null,
    launch_date: document.getElementById('dm-launch').value || null,
    description: document.getElementById('dm-desc').value.trim() || null,
  };

  try {
    let res;
    if (_editingDropId) {
      res = await fetch(`/api/meta/drops/${_editingDropId}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } else {
      res = await fetch('/api/meta/drops', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    }
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Unknown error');
    closeDropModal();
    loadDrops();
  } catch (e) {
    errEl.textContent = e.message || 'Failed to save drop.';
    errEl.classList.remove('hidden');
  }
}

async function toggleDropActive(dropId, isActive) {
  try {
    const res = await fetch(`/api/meta/drops/${dropId}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: isActive })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed');
    loadDrops();
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeDropModal();
});

async function loadHealth() {
  try {
    const [wd, inv, alertSum] = await Promise.all([
      fetch('/api/brain/watchdog', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/brain/invariants/check', { credentials: 'include' }).then(r => r.json()).catch(() => ({})),
      fetch('/api/brain/alerts/summary', { credentials: 'include' }).then(r => r.json()).catch(() => ({}))
    ]);
    const summary = wd.summary || {};
    const setH = (id, val, warn) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = val ?? '—';
      el.className = `text-2xl font-bold ${(warn && val > 0) ? 'text-rose-600' : 'text-emerald-600'}`;
    };
    setH('h-uncategorized', summary.uncategorized ?? (wd.uncategorized || []).length, true);
    setH('h-pending',       summary.stale_manual   ?? (wd.stale_manual || []).length,   true);
    setH('h-overdue',       summary.aged_unpaid    ?? (wd.aged_unpaid || []).length,     true);
    setH('h-duplicates',    summary.duplicates     ?? (wd.duplicates || []).length,      true);
    if (inv.invariants) {
      const i = inv.invariants;
      setH('inv-missing-dims',     i.posted_missing_dims,              true);
      setH('inv-unposted',         i.unposted_postable_items,          false);
      setH('inv-verified-unposted', i.verified_documents_with_unposted, true);
      setH('inv-duplicates',       i.duplicate_file_hash_count,        true);
    }
    if (alertSum.summary) {
      const a = alertSum.summary;
      const fmt = n => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
      setH('as-total-docs', a.total_unposted_docs, true);
      const amtEl = document.getElementById('as-total-amt');
      if (amtEl) amtEl.textContent = fmt(a.unposted_amount);
      setH('as-aged', a.aged_unposted_docs, true);
      setH('as-hv', a.high_value_unposted_docs, true);
      const hvEl = document.getElementById('as-hv-amt');
      if (hvEl) hvEl.textContent = a.high_value_unposted_docs > 0 ? fmt(a.high_value_unposted_amount) : '';
      setH('as-golive', a.go_live_unposted_docs, true);
      const glEl = document.getElementById('as-golive-amt');
      if (glEl) glEl.textContent = a.go_live_unposted_docs > 0 ? fmt(a.go_live_unposted_amount) : '';
    }
  } catch (_) {}
}

// ─── Budget Alerts ───────────────────────────────────────────────────────────

async function loadAlerts() {
  const container = document.getElementById('alerts-list');
  if (!container) return;
  try {
    const data = await fetch('/api/brain/alerts', { credentials: 'include' }).then(r => r.json());
    const alerts = data.alerts || [];
    if (!alerts.length) {
      container.innerHTML = '<p class="text-sm text-emerald-600"><i class="fas fa-circle-check mr-1"></i>No active alerts — all budgets within thresholds.</p>';
      return;
    }
    container.innerHTML = alerts.map(a => {
      const isCrit = a.severity === 'critical';
      const bg = isCrit ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-700';
      const icon = isCrit ? 'fa-triangle-exclamation' : 'fa-circle-exclamation';
      const ts = a.created_at ? new Date(a.created_at).toLocaleDateString() : '';
      return `<div class="flex items-start gap-3 px-4 py-3 border rounded-xl ${bg}">
        <i class="fas ${icon} mt-0.5 shrink-0"></i>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold">${escapeHtml((a.alert_type || '').replace(/_/g,' '))}</p>
          <p class="text-xs mt-0.5">${escapeHtml(a.message || '')}</p>
          ${ts ? `<p class="text-[10px] opacity-60 mt-1">${ts}</p>` : ''}
        </div>
        <span class="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${isCrit ? 'bg-red-100' : 'bg-amber-100'}">${a.severity || ''}</span>
      </div>`;
    }).join('');
  } catch (_) {
    const container = document.getElementById('alerts-list');
    if (container) container.innerHTML = '<p class="text-sm text-slate-400">Could not load alerts.</p>';
  }
}

async function runBudgetAlerts() {
  try {
    const r = await fetch('/api/brain/alerts/run', { method: 'POST', credentials: 'include' });
    const d = await r.json();
    if (d.success) {
      await loadAlerts();
    } else {
      alert('Failed to run alerts: ' + (d.error || 'unknown'));
    }
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

function escapeHtml(str = '') {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function loadUsers() {
  const tbody = document.getElementById('users-table-body');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-6 text-center text-slate-500 text-sm">Loading users…</td></tr>`;
  try {
    const res = await fetch(USERS_API, { credentials: 'include' });
    if (!res.ok) throw new Error('Unable to load users');
    const data = await res.json();
    const users = data.users || [];
    if (!users.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-6 text-center text-slate-500 text-sm">No users found.</td></tr>`;
      return;
    }
    tbody.innerHTML = users
      .map((user) => {
        const safeEmail = escapeHtml(user.email);
        const safeName = escapeHtml(user.name || user.email);
        const roleOptions = ['uploader', 'manager', 'admin']
          .map(r => `<option value="${r}" ${r === user.role ? 'selected' : ''}>${r.charAt(0).toUpperCase() + r.slice(1)}</option>`)
          .join('');
        return `
          <tr>
            <td class="px-4 py-3">
              <p class="font-semibold">${safeName}</p>
              <p class="text-xs text-slate-500">${safeEmail}</p>
            </td>
            <td class="px-4 py-3">
              <select class="px-2 py-1 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-400"
                onchange="changeUserRole(${user.id}, this.value, this)">
                ${roleOptions}
              </select>
            </td>
            <td class="px-4 py-3 text-sm text-slate-600">${formatDateTime(user.created_at)}</td>
            <td class="px-4 py-3 text-sm text-slate-600">${user.last_login ? formatDateTime(user.last_login) : '—'}</td>
            <td class="px-4 py-3 text-right">
              <button class="px-3 py-2 rounded-lg text-xs font-semibold border border-slate-200 hover:border-rose-400 hover:text-rose-600 transition"
                onclick="deleteUser(${user.id}, '${safeEmail}')">
                <i class="fas fa-trash mr-1"></i>Remove
              </button>
            </td>
          </tr>
        `;
      })
      .join('');
  } catch (err) {
    console.error('Failed to load users', err);
    tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-6 text-center text-rose-500 text-sm">${err.message || 'Failed to load users'}</td></tr>`;
  }
}

async function handleCreateUser(event) {
  event.preventDefault();
  const messageEl = document.getElementById('create-user-message');
  if (messageEl) {
    messageEl.textContent = '';
  }
  const email = document.getElementById('new-user-email').value.trim().toLowerCase();
  const password = document.getElementById('new-user-password').value.trim();
  const fullName = document.getElementById('new-user-name').value.trim();
  const role = document.getElementById('new-user-role').value;

  if (!email || !password || !role) {
    showCreateMessage('Email, password and role are required.', 'error');
    return;
  }

  try {
    const res = await fetch(USERS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        email,
        password,
        role,
        full_name: fullName || null
      })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Unable to create user');
    }
    showCreateMessage(`Created user ${email}`, 'success');
    document.getElementById('create-user-form').reset();
    loadUsers();
  } catch (err) {
    console.error('Create user failed', err);
    showCreateMessage(err.message || 'Unable to create user', 'error');
  }
}

function showCreateMessage(text, tone = 'muted') {
  const messageEl = document.getElementById('create-user-message');
  if (!messageEl) return;
  const toneClass =
    tone === 'error'
      ? 'text-rose-600'
      : tone === 'success'
      ? 'text-emerald-600'
      : 'text-slate-500';
  messageEl.textContent = text;
  messageEl.className = `text-sm ${toneClass}`;
}

function formatDateTime(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch (err) {
    return value;
  }
}

window.changeUserRole = async function changeUserRole(userId, role, selectEl) {
  const prev = selectEl.dataset.prev || selectEl.value;
  selectEl.dataset.prev = selectEl.value;
  try {
    const res = await fetch(`${USERS_API}/${userId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update role');
    selectEl.dataset.prev = role;
  } catch (err) {
    console.error('Change role failed', err);
    selectEl.value = prev;
    alert(err.message || 'Unable to update role');
  }
};

window.deleteUser = async function deleteUser(userId, email) {
  if (!userId) return;
  const confirmed = confirm(`Remove user "${email}"? Their uploads will stay but ownership will clear.`);
  if (!confirmed) return;
  try {
    const res = await fetch(`${USERS_API}/${userId}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Unable to delete user');
    }
    loadUsers();
  } catch (err) {
    console.error('Delete user failed', err);
    alert(err.message || 'Unable to delete user');
  }
};

// ─── Ingest: drops population ────────────────────────────────────────────────

async function loadIngestDrops() {
  try {
    const d = await fetch('/api/meta/drops', { credentials: 'include' }).then(r => r.json());
    ['mkt-drop', 'ship-drop'].forEach(selId => {
      const sel = document.getElementById(selId);
      if (!sel) return;
      (d.drops || []).forEach(drop => {
        const o = document.createElement('option');
        o.value = drop.drop_name;
        o.textContent = drop.drop_name;
        sel.appendChild(o);
      });
    });
  } catch (_) {}
}

// ─── Ingest: Marketing Spend ─────────────────────────────────────────────────

async function ingestMarketing() {
  const channel = document.getElementById('mkt-channel')?.value;
  const amount  = parseFloat(document.getElementById('mkt-amount')?.value);
  const date    = document.getElementById('mkt-date')?.value;
  const drop    = document.getElementById('mkt-drop')?.value;
  const campaign = document.getElementById('mkt-campaign')?.value;
  const msg = document.getElementById('mkt-msg');

  if (!channel || !amount || !date) {
    if (msg) { msg.textContent = 'Channel, amount, and date are required'; msg.className = 'text-xs text-red-500'; msg.classList.remove('hidden'); }
    return;
  }

  try {
    const res = await fetch('/api/ingest/marketing', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, amount, spend_date: date, drop_name: drop || null, campaign: campaign || null, source: 'admin' })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed');
    document.getElementById('mkt-amount').value = '';
    document.getElementById('mkt-campaign').value = '';
    if (msg) { msg.textContent = '✓ Marketing spend recorded'; msg.className = 'text-xs text-emerald-600'; msg.classList.remove('hidden'); }
    setTimeout(() => msg?.classList.add('hidden'), 3000);
  } catch (e) {
    if (msg) { msg.textContent = '✗ ' + e.message; msg.className = 'text-xs text-red-500'; msg.classList.remove('hidden'); }
  }
}

// ─── Ingest: Shipment Cost ────────────────────────────────────────────────────

async function ingestShipment() {
  const carrier   = document.getElementById('ship-carrier')?.value;
  const amount    = parseFloat(document.getElementById('ship-amount')?.value);
  const orderId   = document.getElementById('ship-order')?.value;
  const tracking  = document.getElementById('ship-tracking')?.value;
  const drop      = document.getElementById('ship-drop')?.value;
  const sku       = document.getElementById('ship-sku')?.value;
  const msg = document.getElementById('ship-msg');

  if (!amount) {
    if (msg) { msg.textContent = 'Charge amount is required'; msg.className = 'text-xs text-red-500'; msg.classList.remove('hidden'); }
    return;
  }

  try {
    const res = await fetch('/api/ingest/shipment', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ carrier, charge_amount: amount, order_id: orderId || null, tracking_number: tracking || null, drop_name: drop || null, sku_code: sku || null })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed');
    document.getElementById('ship-amount').value = '';
    document.getElementById('ship-order').value = '';
    document.getElementById('ship-tracking').value = '';
    document.getElementById('ship-sku').value = '';
    if (msg) { msg.textContent = '✓ Shipment cost recorded'; msg.className = 'text-xs text-emerald-600'; msg.classList.remove('hidden'); }
    setTimeout(() => msg?.classList.add('hidden'), 3000);
  } catch (e) {
    if (msg) { msg.textContent = '✗ ' + e.message; msg.className = 'text-xs text-red-500'; msg.classList.remove('hidden'); }
  }
}

// ─── Finance overview ─────────────────────────────────────────────────────────

async function loadFinanceSummary() {
  const days = document.getElementById('finance-days')?.value || 90;
  const totalsEl = document.getElementById('finance-totals');
  const dropsEl = document.getElementById('finance-drops');
  const vendorsEl = document.getElementById('finance-vendors');
  if (!totalsEl) return;

  try {
    const data = await fetch(`/api/brain/summary?days=${days}`, { credentials: 'include' }).then(r => r.json());
    const t = data.totals || {};
    const fmt = n => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

    const cats = [
      { label: 'COGS', val: t.cogs, color: 'text-indigo-700' },
      { label: 'Fulfillment', val: t.fulfillment, color: 'text-blue-700' },
      { label: 'Marketing', val: t.marketing, color: 'text-violet-700' },
      { label: 'Operations', val: t.operations, color: 'text-slate-700' },
    ];
    totalsEl.innerHTML = cats.map(c => `
      <div class="text-center p-3 bg-slate-50 rounded-xl">
        <p class="text-xs text-slate-500">${c.label}</p>
        <p class="text-lg font-semibold ${c.color} mt-1">${fmt(c.val)}</p>
      </div>`).join('');

    const drops = data.drops || [];
    dropsEl.innerHTML = drops.length
      ? drops.slice(0, 8).map(d => {
          const pct = t.spend ? (Number(d.total) / t.spend * 100).toFixed(0) : 0;
          return `<div class="flex items-center justify-between py-1">
            <a href="drop.html?drop=${encodeURIComponent(d.drop_name)}" class="text-indigo-600 hover:underline truncate max-w-[140px]">${d.drop_name}</a>
            <span class="font-medium text-slate-700 ml-2">${fmt(d.total)} <span class="text-slate-400">${pct}%</span></span>
          </div>`;
        }).join('')
      : '<span class="text-slate-400">No data</span>';

    const vendors = data.vendors || [];
    vendorsEl.innerHTML = vendors.length
      ? vendors.slice(0, 8).map(v => `<div class="flex items-center justify-between py-1">
          <span class="text-slate-600 truncate max-w-[140px]">${v.vendor_name || 'Unknown'}</span>
          <span class="font-medium text-slate-700 ml-2">${fmt(v.total)}</span>
        </div>`).join('')
      : '<span class="text-slate-400">No data</span>';
  } catch (e) {
    totalsEl.innerHTML = `<div class="text-xs text-red-400 col-span-4 py-4">Failed to load finance summary</div>`;
  }
}

async function loadAuditLog() {
    const tbody = document.getElementById('audit-tbody');
    if (!tbody) return;
    const actor = document.getElementById('audit-actor')?.value || '';
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-slate-400">Loading…</td></tr>';
    try {
        const params = new URLSearchParams({ limit: 100 });
        if (actor) params.set('actor_type', actor);
        const data = await authFetch(`/api/documents/audit-log?${params}`).then(r => r.json());
        const entries = data.entries || [];
        if (!entries.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center py-6 text-slate-400">No audit entries found</td></tr>';
            return;
        }
        tbody.innerHTML = entries.map(e => {
            const when = new Date(e.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
            const who = e.actor_email ? e.actor_email.split('@')[0] : (e.actor_type || 'system');
            const doc = e.file_name || `doc#${e.document_id}`;
            const docLink = e.document_id ? `<a href="documents.html?doc=${e.document_id}" class="text-indigo-500 hover:underline" title="${e.file_name || ''}">${doc}</a>` : doc;
            const field = (e.field_name || '').replace(/_/g, ' ');
            const oldV = e.old_value != null ? String(e.old_value).slice(0, 30) : '—';
            const newV = e.new_value != null ? String(e.new_value).slice(0, 30) : '—';
            return `<tr class="border-t border-slate-100 hover:bg-slate-50">
                <td class="px-3 py-2 text-slate-400 whitespace-nowrap">${when}</td>
                <td class="px-3 py-2 max-w-[120px] truncate">${docLink}</td>
                <td class="px-3 py-2 text-slate-600">${field}</td>
                <td class="px-3 py-2 text-rose-400 max-w-[100px] truncate">${oldV}</td>
                <td class="px-3 py-2 text-emerald-600 max-w-[100px] truncate">${newV}</td>
                <td class="px-3 py-2 font-medium text-slate-700">${who}</td>
                <td class="px-3 py-2 text-slate-400">${e.source_action || '—'}</td>
            </tr>`;
        }).join('');
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-red-400">Error: ${e.message}</td></tr>`;
    }
}
