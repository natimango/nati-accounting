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
    const wd = await fetch('/api/brain/watchdog', { credentials: 'include' }).then(r => r.json());
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
  } catch (_) {}
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
