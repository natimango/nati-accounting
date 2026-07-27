const API_URL = '/api/brain';
const META_URL = '/api/meta';
const REPORT_API = '/api/reports';
const DEFAULT_BUDGET_GROUPS = ['COGS', 'FULFILLMENT', 'MARKETING', 'OPERATIONS'];

let currentDrop = null;
let budgetGroups = [...DEFAULT_BUDGET_GROUPS];

function authFetch(url, options = {}) {
  return fetch(url, Object.assign({ credentials: 'include' }, options));
}

function formatCurrency(val) {
  const n = Number(val || 0);
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function formatGroupLabel(group) {
  return (group || 'OPERATIONS').toString().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getBudgetWindow() {
  const now = new Date();
  const fyYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    start: new Date(fyYear, 3, 1).toISOString().split('T')[0],
    end: new Date(fyYear + 1, 2, 31).toISOString().split('T')[0]
  };
}

function setBudgetMessage(text, tone = 'muted') {
  const msg = document.getElementById('budget-message');
  if (!msg) return;
  msg.textContent = text || '';
  msg.className = `text-xs ${tone === 'error' ? 'text-rose-600' : tone === 'success' ? 'text-emerald-600' : 'text-slate-500'}`;
}

// ---- Drop selector ----

async function loadDropList() {
  try {
    const r = await authFetch(`${META_URL}/drops`);
    const data = await r.json();
    const drops = data.drops || [];
    const sel = document.getElementById('drop-select');
    sel.innerHTML = '<option value="">— select drop —</option>';
    drops.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.drop_name;
      opt.textContent = d.drop_name;
      sel.appendChild(opt);
    });

    // Auto-select from URL param
    const params = new URLSearchParams(window.location.search);
    const urlDrop = params.get('drop');
    if (urlDrop) {
      sel.value = urlDrop;
      onDropChange();
    }
  } catch (e) {
    console.error('loadDropList error', e);
  }
}

function onDropChange() {
  const sel = document.getElementById('drop-select');
  const name = sel.value;
  if (!name) {
    currentDrop = null;
    showEmptyState();
    return;
  }
  currentDrop = name;
  const link = document.getElementById('view-bills-link');
  if (link) link.href = `documents.html?drop=${encodeURIComponent(name)}`;
  const plLink = document.getElementById('view-pl-link');
  if (plLink) { plLink.href = `reports.html?drop=${encodeURIComponent(name)}`; plLink.classList.remove('hidden'); }
  loadDrop(name);
}

function showEmptyState() {
  document.getElementById('empty-state').classList.remove('hidden');
  document.getElementById('summary-section').classList.add('hidden');
  document.getElementById('budget-section').classList.add('hidden');
  document.getElementById('category-section').classList.add('hidden');
  document.getElementById('vendors-section').classList.add('hidden');
}

function showDropContent() {
  document.getElementById('empty-state').classList.add('hidden');
  document.getElementById('summary-section').classList.remove('hidden');
  document.getElementById('budget-section').classList.remove('hidden');
  document.getElementById('category-section').classList.remove('hidden');
  document.getElementById('vendors-section').classList.remove('hidden');
}

// ---- Load drop data ----

async function loadDrop(dropName) {
  if (!dropName) return;
  try {
    const resp = await authFetch(`${API_URL}/drop/${encodeURIComponent(dropName)}/cost`);
    const data = await resp.json();
    if (!resp.ok || data.error) throw new Error(data.error || 'Failed to load drop');

    showDropContent();

    document.getElementById('total-committed').textContent = formatCurrency(data.totals.committed);
    document.getElementById('total-paid').textContent = formatCurrency(data.totals.paid);
    document.getElementById('total-outstanding').textContent = formatCurrency(data.totals.outstanding);

    // Budget utilisation
    const budgetTotals = data.budgetTotals || {};
    const budgeted = Number(budgetTotals.budgeted || 0);
    const actualSpend = Number(data.totals.committed || 0);
    if (budgeted > 0) {
      const pct = Math.round((actualSpend / budgeted) * 100);
      document.getElementById('budget-utilisation').textContent = pct + '%';
      document.getElementById('budget-utilisation').className =
        `text-2xl font-semibold mt-1 ${pct > 100 ? 'text-rose-600' : pct > 80 ? 'text-amber-600' : 'text-emerald-600'}`;
    } else {
      document.getElementById('budget-utilisation').textContent = '—';
      document.getElementById('budget-utilisation').className = 'text-2xl font-semibold mt-1';
    }

    renderSectionBreakdown(data.bySection || []);
    renderCategoryTable(data.byCategory || []);
    renderVendorTable(data.byVendor || []);
    renderSkuTable(data.perSku || []);
    renderBudgetInputs(data.budgetSummary || []);
    renderBudgetSummary(data.budgetSummary || [], budgetTotals);
    setBudgetMessage('');
  } catch (err) {
    console.error('Drop load error', err);
    showDropContent();
    document.getElementById('total-committed').textContent = '—';
    document.getElementById('total-paid').textContent = '—';
    document.getElementById('total-outstanding').textContent = '—';
    document.getElementById('cat-body').innerHTML =
      `<tr><td colspan="4" class="px-4 py-3 text-center text-rose-500 text-sm">${err.message || 'Failed to load drop'}</td></tr>`;
  }
}

function renderSectionBreakdown(rows) {
  const container = document.getElementById('section-breakdown');
  if (!rows || rows.length === 0) {
    container.classList.add('hidden');
    return;
  }
  const map = {};
  rows.forEach(r => { map[(r.section || '').toLowerCase()] = Number(r.committed || 0); });
  document.getElementById('sec-regulars').textContent = formatCurrency(map['regulars'] || 0);
  document.getElementById('sec-artwear').textContent = formatCurrency(map['artwear'] || 0);
  document.getElementById('sec-collectibles').textContent = formatCurrency(map['collectibles'] || 0);
  container.classList.remove('hidden');
}

function renderCategoryTable(rows) {
  const body = document.getElementById('cat-body');
  if (!body) return;
  body.innerHTML = rows.length
    ? rows.map(r => `
        <tr>
          <td class="px-4 py-2">${r.category}</td>
          <td class="px-4 py-2 text-right">${formatCurrency(r.committed)}</td>
          <td class="px-4 py-2 text-right">${formatCurrency(r.paid)}</td>
          <td class="px-4 py-2 text-right ${Number(r.outstanding) > 0 ? 'text-amber-600 font-medium' : ''}">${formatCurrency(r.outstanding)}</td>
        </tr>
      `).join('')
    : `<tr><td colspan="4" class="px-4 py-3 text-center text-slate-500 text-sm">No bills tagged to this drop yet.</td></tr>`;
}

function renderVendorTable(rows) {
  const body = document.getElementById('vendor-body');
  if (!body) return;
  body.innerHTML = rows.length
    ? rows.map(v => `
        <tr>
          <td class="px-4 py-2">${v.vendor_name || '—'}</td>
          <td class="px-4 py-2 text-right">${formatCurrency(v.committed)}</td>
          <td class="px-4 py-2 text-right">${formatCurrency(v.paid)}</td>
        </tr>
      `).join('')
    : `<tr><td colspan="3" class="px-4 py-3 text-center text-slate-500 text-sm">No vendor data</td></tr>`;
}

function renderSkuTable(rows) {
  const body = document.getElementById('sku-body');
  if (!body) return;
  body.innerHTML = rows.length
    ? rows.map(s => `
        <tr>
          <td class="px-4 py-2">${s.sku_code}</td>
          <td class="px-4 py-2 text-right">${formatCurrency(s.spend)}</td>
        </tr>
      `).join('')
    : `<tr><td colspan="2" class="px-4 py-3 text-center text-slate-500 text-sm">No SKU-tagged items</td></tr>`;
}

function renderBudgetInputs(summary) {
  const container = document.getElementById('budget-form-fields');
  if (!container) return;
  const groups = new Set(DEFAULT_BUDGET_GROUPS);
  summary.forEach(row => { if (row.category_group) groups.add(row.category_group.toUpperCase()); });
  budgetGroups = Array.from(groups);
  container.innerHTML = budgetGroups.map(group => {
    const existing = summary.find(r => (r.category_group || '').toUpperCase() === group);
    const value = existing && existing.budget_amount ? Number(existing.budget_amount) : '';
    return `
      <div>
        <label class="block text-xs font-semibold text-slate-600 mb-1">${formatGroupLabel(group)} budget (₹)</label>
        <input id="budget-input-${group}" type="number" min="0" step="1000" value="${value !== '' ? value : ''}"
          class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm" placeholder="0" />
      </div>`;
  }).join('');
}

function renderBudgetSummary(summary, totals) {
  const body = document.getElementById('budget-summary-body');
  const totalEl = document.getElementById('budget-total');
  const varianceEl = document.getElementById('budget-variance');

  if (body) {
    if (!summary.length) {
      body.innerHTML = `<tr><td colspan="5" class="px-4 py-3 text-center text-slate-500 text-sm">No budgets set yet. Use the form below to add one.</td></tr>`;
    } else {
      body.innerHTML = summary.map(row => {
        const variance = Number(row.variance || 0);
        const positive = variance >= 0;
        return `
          <tr>
            <td class="px-4 py-2 font-medium">${formatGroupLabel(row.category_group)}</td>
            <td class="px-4 py-2 text-right">${formatCurrency(row.budget_amount)}</td>
            <td class="px-4 py-2 text-right">${formatCurrency(row.actual_amount)}</td>
            <td class="px-4 py-2 text-right ${positive ? 'text-emerald-600' : 'text-rose-600'}">${positive ? '+' : ''}${formatCurrency(variance)}</td>
            <td class="px-4 py-2">
              <span class="inline-flex items-center px-2 py-1 rounded-full text-xs ${positive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}">
                ${positive ? 'Under budget' : 'Over budget'}
              </span>
            </td>
          </tr>`;
      }).join('');
    }
  }

  if (totalEl) totalEl.textContent = formatCurrency(totals.budgeted || 0);
  if (varianceEl) {
    const variance = Number(totals.variance || 0);
    const positive = variance >= 0;
    varianceEl.textContent = `${positive ? '+' : ''}${formatCurrency(variance)} vs budget`;
    varianceEl.className = positive ? 'text-xs font-semibold text-emerald-600' : 'text-xs font-semibold text-rose-600';
  }
}

// ---- Save budgets ----

async function saveBudgets() {
  const saveBtn = document.getElementById('budget-save');
  if (!saveBtn || !currentDrop) return;
  const { start, end } = getBudgetWindow();
  const requests = [];
  (budgetGroups.length ? budgetGroups : DEFAULT_BUDGET_GROUPS).forEach(group => {
    const input = document.getElementById(`budget-input-${group}`);
    if (!input || !input.value.trim()) return;
    const amount = Number(input.value);
    if (isNaN(amount)) return;
    requests.push(authFetch(`${REPORT_API}/drop-budgets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drop_name: currentDrop, department: group, amount, start_date: start, end_date: end, notes: null })
    }));
  });

  if (!requests.length) { setBudgetMessage('Enter at least one budget amount to save.', 'error'); return; }

  try {
    saveBtn.disabled = true;
    saveBtn.classList.add('opacity-60', 'cursor-not-allowed');
    setBudgetMessage('Saving budgets…');
    await Promise.all(requests);
    setBudgetMessage('Budgets saved.', 'success');
    await loadDrop(currentDrop);
  } catch (err) {
    console.error('Save budgets error', err);
    setBudgetMessage(err.message || 'Failed to save budgets.', 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.classList.remove('opacity-60', 'cursor-not-allowed');
  }
}

// ---- New drop modal ----

function showNewDropModal() {
  document.getElementById('new-drop-modal').classList.remove('hidden');
  document.getElementById('new-drop-name').focus();
  document.getElementById('new-drop-error').classList.add('hidden');
  document.getElementById('new-drop-name').value = '';
  document.getElementById('new-drop-season').value = '';
  document.getElementById('new-drop-launch').value = '';
  document.getElementById('new-drop-desc').value = '';
}

function hideNewDropModal() {
  document.getElementById('new-drop-modal').classList.add('hidden');
}

async function createDrop() {
  const name = document.getElementById('new-drop-name').value.trim();
  const season = document.getElementById('new-drop-season').value.trim();
  const launch = document.getElementById('new-drop-launch').value;
  const desc = document.getElementById('new-drop-desc').value.trim();
  const errEl = document.getElementById('new-drop-error');

  if (!name) {
    errEl.textContent = 'Drop name is required.';
    errEl.classList.remove('hidden');
    return;
  }

  try {
    const r = await authFetch(`${META_URL}/drops`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drop_name: name, description: desc || null, launch_date: launch || null, season: season || null })
    });
    const data = await r.json();
    if (!r.ok || !data.success) throw new Error(data.error || 'Failed to create drop');

    hideNewDropModal();
    await loadDropList();
    // Select the newly created drop
    const sel = document.getElementById('drop-select');
    sel.value = name;
    onDropChange();
  } catch (err) {
    errEl.textContent = err.message || 'Failed to create drop.';
    errEl.classList.remove('hidden');
  }
}

// ---- Init ----

document.addEventListener('DOMContentLoaded', () => {
  const init = () => loadDropList();
  if (window.sessionReady) {
    window.sessionReady.then(init).catch(() => {});
  } else {
    init();
  }
});
