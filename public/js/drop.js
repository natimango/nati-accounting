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
    const r = await authFetch(`${META_URL}/drops?all=1`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    const drops = (data.drops || []).filter(d => d.is_active !== false);
    const sel = document.getElementById('drop-select');
    sel.innerHTML = '<option value="">— select drop —</option>';
    drops.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.drop_name;
      opt.dataset.dropId = d.drop_id;
      opt.dataset.dropNumber = d.drop_number || '';
      opt.textContent = d.drop_number ? `#${d.drop_number} – ${d.drop_name}` : d.drop_name;
      sel.appendChild(opt);
    });

    // Auto-select from URL param
    const params = new URLSearchParams(window.location.search);
    const urlDrop = params.get('drop');
    if (urlDrop) {
      sel.value = urlDrop;
      onDropChange();
    }
    return drops;
  } catch (e) {
    console.error('loadDropList error', e);
    return [];
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
  const upLink = document.getElementById('upload-bill-link');
  if (upLink) { upLink.href = `upload.html?drop=${encodeURIComponent(name)}`; upLink.classList.remove('hidden'); }
  const upMobLink = document.getElementById('upload-mobile-link');
  if (upMobLink) { upMobLink.href = `upload-mobile.html?drop=${encodeURIComponent(name)}`; upMobLink.classList.remove('hidden'); }
  const plLink = document.getElementById('view-pl-link');
  if (plLink) { plLink.href = `reports.html?drop=${encodeURIComponent(name)}`; plLink.classList.remove('hidden'); }
  const archBtn = document.getElementById('archive-drop-btn');
  if (archBtn) archBtn.classList.remove('hidden');
  loadDrop(name);
}

function showEmptyState() {
  document.getElementById('empty-state').classList.remove('hidden');
  document.getElementById('summary-section').classList.add('hidden');
  document.getElementById('budget-section').classList.add('hidden');
  document.getElementById('category-section').classList.add('hidden');
  document.getElementById('vendors-section').classList.add('hidden');
  const plSec = document.getElementById('drop-pl-section');
  if (plSec) plSec.classList.add('hidden');
  const grSec = document.getElementById('guardrails-section');
  if (grSec) grSec.classList.add('hidden');
  const upLink = document.getElementById('upload-bill-link');
  if (upLink) upLink.classList.add('hidden');
  const upMobLink = document.getElementById('upload-mobile-link');
  if (upMobLink) upMobLink.classList.add('hidden');
}

function showDropContent() {
  document.getElementById('empty-state').classList.add('hidden');
  document.getElementById('summary-section').classList.remove('hidden');
  document.getElementById('budget-section').classList.remove('hidden');
  document.getElementById('category-section').classList.remove('hidden');
  document.getElementById('vendors-section').classList.remove('hidden');
}

let _currentDropId = null;
let _goLiveOpen = false;

async function loadGuardrails(dropId) {
  _currentDropId = dropId;
  _goLiveOpen = false;
  const bd = document.getElementById('go-live-breakdown');
  if (bd) bd.classList.add('hidden');
  const sec = document.getElementById('guardrails-section');
  if (!sec || !dropId) return;
  try {
    const r = await authFetch(`/api/brain/guardrails/drop/${dropId}`);
    if (!r.ok) return;
    const d = await r.json();
    if (!d.success) return;
    const fmt = n => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
    document.getElementById('gr-go-live').textContent   = fmt(d.go_live?.total_go_live_cost);
    document.getElementById('gr-break-even').textContent = d.break_even_units != null ? d.break_even_units + ' units' : '—';
    document.getElementById('gr-cm').textContent         = fmt(d.contribution?.blended_contribution_margin);
    document.getElementById('gr-mktg').textContent       = fmt(d.allowed_marketing_budget);
    sec.classList.remove('hidden');

    // Load CAC tiers async
    _loadCacTiers(dropId);
  } catch (_) {}
}

async function _loadCacTiers(dropId) {
  const el = document.getElementById('gr-cac-tiers');
  if (!el) return;
  try {
    const data = await authFetch(`/api/brain/max-cac/tiers?dropId=${dropId}`).then(r => r.json());
    const tiers = data.data?.tiers || [];
    if (!tiers.length) { el.textContent = 'No SKU data for this drop'; return; }
    const TIER_LABEL = { budget: 'Budget (≤₹1.5k)', core: 'Core (₹1.5k–3k)', premium: 'Premium (>₹3k)' };
    const TIER_COLOR = { budget: 'bg-slate-50 text-slate-700', core: 'bg-indigo-50 text-indigo-700', premium: 'bg-violet-50 text-violet-700' };
    el.innerHTML = `<div class="grid grid-cols-3 gap-2">
      ${tiers.map(t => `
        <div class="rounded-lg p-2 text-center ${TIER_COLOR[t.tier] || 'bg-slate-50 text-slate-700'}">
          <p class="text-[10px] font-medium uppercase tracking-wide">${TIER_LABEL[t.tier] || t.tier}</p>
          <p class="font-bold mt-0.5">₹${Number(t.max_cac).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          <p class="text-[10px] opacity-60">max CAC · ${t.sku_count} SKU${t.sku_count !== 1 ? 's' : ''}</p>
        </div>`).join('')}
    </div>`;
  } catch (e) {
    el.textContent = 'Could not load CAC tiers';
  }
}

async function toggleGoLiveBreakdown() {
  const wrap = document.getElementById('go-live-breakdown');
  if (!wrap) return;
  _goLiveOpen = !_goLiveOpen;
  wrap.classList.toggle('hidden', !_goLiveOpen);
  if (_goLiveOpen && _currentDropId) {
    const content = document.getElementById('go-live-breakdown-content');
    try {
      const data = await authFetch(`/api/drops/${_currentDropId}/go-live`).then(r => r.json());
      if (!data.success) throw new Error(data.error || 'Failed');
      const t = data.totals || {};
      const bd = data.breakdowns || {};
      const fmt = n => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
      const fmtRow = (label, val, extra) => `<div class="flex justify-between py-1 border-b border-slate-50">
        <span class="text-slate-600">${label}</span>
        <span class="font-semibold text-slate-800">${fmt(val)}${extra ? ' <span class="text-slate-400 font-normal">' + extra + '</span>' : ''}</span>
      </div>`;

      const deptRows = (bd.by_department || []).map(r => fmtRow(r.department_name || 'Unassigned', r.amount)).join('');
      const vendorRows = (bd.by_vendor || []).slice(0, 6).map(r => fmtRow(r.vendor_name, r.amount)).join('');
      const unpostedNote = t.unposted_go_live_count > 0
        ? `<p class="text-amber-600 text-xs mt-2"><i class="fas fa-triangle-exclamation mr-1"></i>${t.unposted_go_live_count} unposted item(s) worth ${fmt(t.excluded_unposted_amount)} excluded from go-live cost</p>`
        : '';
      content.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p class="font-semibold text-slate-700 mb-2">By department</p>
            ${deptRows || '<p class="text-slate-400">No department data</p>'}
          </div>
          <div>
            <p class="font-semibold text-slate-700 mb-2">By vendor</p>
            ${vendorRows || '<p class="text-slate-400">No vendor data</p>'}
          </div>
        </div>
        ${unpostedNote}`;
    } catch (e) {
      document.getElementById('go-live-breakdown-content').innerHTML = `<span class="text-rose-400">Failed to load breakdown: ${e.message}</span>`;
    }
  }
}

// ---- Load drop data ----

async function loadDropPL(dropName) {
  const sec = document.getElementById('drop-pl-section');
  if (!sec) return;
  try {
    // Get drop_id from the select option
    const sel = document.getElementById('drop-select');
    const opt = sel ? Array.from(sel.options).find(o => o.value === dropName) : null;
    const dropId = opt?.dataset?.dropId;

    // Update P&L link
    const plLink = document.getElementById('drop-pl-link');
    if (plLink) plLink.href = `reports.html?drop=${encodeURIComponent(dropName)}`;

    const url = dropId
      ? `/api/reports/sales?drop_id=${encodeURIComponent(dropId)}`
      : `/api/reports/sales`;
    const r = await authFetch(url);
    const d = await r.json();
    const entries = d.entries || [];
    const netSales   = entries.reduce((s, e) => s + parseFloat(e.net_sales || 0), 0);
    const units      = entries.reduce((s, e) => s + (parseInt(e.gross_units||0) - parseInt(e.returned_units||0)), 0);

    // Get COGS from the cost overview (totals.committed is already loaded — use cached data)
    // We'll show it from the cost data if available
    const committed  = parseFloat(document.getElementById('total-committed')?.textContent?.replace(/[₹,]/g,'') || 0);

    const gp     = netSales - committed;
    const gpPct  = netSales ? (gp / netSales * 100).toFixed(1) : '—';
    const fmt    = n => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });

    const salesEl = document.getElementById('dpl-sales');
    if (salesEl) {
      salesEl.textContent = netSales > 0 ? fmt(netSales) : '—';
      if (dropId && netSales > 0) {
        salesEl.style.cursor = 'pointer';
        salesEl.title = 'Click to view sales entries';
        salesEl.onclick = () => { location.href = `sales.html?drop_id=${encodeURIComponent(dropId)}`; };
      }
    }
    document.getElementById('dpl-cogs').textContent   = committed > 0 ? fmt(committed) : '—';
    document.getElementById('dpl-gp').textContent     = (netSales > 0 || committed > 0) ? fmt(gp) : '—';
    document.getElementById('dpl-gp-pct').textContent = netSales > 0 ? gpPct + '% GM' : '';
    document.getElementById('dpl-units').textContent  = units > 0 ? units.toLocaleString('en-IN') : '—';
    if (netSales > 0 || committed > 0) sec.classList.remove('hidden');
    else sec.classList.add('hidden');
  } catch (e) {
    console.error('loadDropPL error', e);
    const sec = document.getElementById('drop-pl-section');
    if (sec) sec.classList.add('hidden');
  }
}

async function loadDrop(dropName) {
  if (!dropName) return;
  // Reset expandable sections when drop changes
  budgetHistoryOpen = false;
  const histWrap = document.getElementById('budget-history-wrap');
  if (histWrap) histWrap.classList.add('hidden');
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
    // Load P&L and guardrails after main data is ready
    loadDropPL(dropName);
    const sel = document.getElementById('drop-select');
    const opt = sel ? Array.from(sel.options).find(o => o.value === dropName) : null;
    const dropId = opt?.dataset?.dropId;
    if (dropId) loadGuardrails(dropId);
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
  const drop = document.getElementById('drop-select')?.value || '';
  body.innerHTML = rows.length
    ? rows.map(r => {
        const href = drop
          ? `documents.html?drop=${encodeURIComponent(drop)}&q=${encodeURIComponent(r.category)}`
          : `documents.html?q=${encodeURIComponent(r.category)}`;
        return `<tr class="hover:bg-slate-50">
          <td class="px-4 py-2"><a href="${href}" class="text-indigo-700 hover:underline">${r.category}</a></td>
          <td class="px-4 py-2 text-right">${formatCurrency(r.committed)}</td>
          <td class="px-4 py-2 text-right">${formatCurrency(r.paid)}</td>
          <td class="px-4 py-2 text-right ${Number(r.outstanding) > 0 ? 'text-amber-600 font-medium' : ''}">${formatCurrency(r.outstanding)}</td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="4" class="px-4 py-3 text-center text-slate-500 text-sm">No bills tagged to this drop yet.</td></tr>`;
}

function renderVendorTable(rows) {
  const body = document.getElementById('vendor-body');
  if (!body) return;
  const drop = document.getElementById('drop-select')?.value || '';
  body.innerHTML = rows.length
    ? rows.map(v => {
        const href = drop
          ? `documents.html?drop=${encodeURIComponent(drop)}&q=${encodeURIComponent(v.vendor_name || '')}`
          : `documents.html?q=${encodeURIComponent(v.vendor_name || '')}`;
        return `<tr class="hover:bg-slate-50">
          <td class="px-4 py-2"><a href="${href}" class="text-indigo-700 hover:underline">${v.vendor_name || '—'}</a></td>
          <td class="px-4 py-2 text-right">${formatCurrency(v.committed)}</td>
          <td class="px-4 py-2 text-right">${formatCurrency(v.paid)}</td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="3" class="px-4 py-3 text-center text-slate-500 text-sm">No vendor data</td></tr>`;
}

function renderSkuTable(rows) {
  const body = document.getElementById('sku-body');
  if (!body) return;
  body.innerHTML = rows.length
    ? rows.map(s => {
        const amt = parseFloat(s.spend || s.total_amount || 0);
        const qty = parseInt(s.total_qty || 0);
        return `<tr>
          <td class="px-4 py-2 font-mono text-xs">
            <a href="garment-economics.html?sku=${encodeURIComponent(s.sku_code)}" class="text-indigo-600 hover:underline" title="View garment economics">${s.sku_code}</a>
          </td>
          <td class="px-4 py-2 text-right text-xs text-slate-500">${qty > 0 ? qty + ' units' : '—'}</td>
          <td class="px-4 py-2 text-right">${formatCurrency(amt)}</td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="3" class="px-4 py-3 text-center text-slate-500 text-sm">No SKU-tagged items</td></tr>`;
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

// ---- Budget history ----

let budgetHistoryOpen = false;

async function toggleBudgetHistory() {
  const wrap = document.getElementById('budget-history-wrap');
  if (!wrap) return;
  budgetHistoryOpen = !budgetHistoryOpen;
  wrap.classList.toggle('hidden', !budgetHistoryOpen);
  if (budgetHistoryOpen && currentDrop) {
    await loadBudgetHistory();
  }
}

async function loadBudgetHistory() {
  const body = document.getElementById('budget-history-body');
  if (!body || !currentDrop) return;
  try {
    const data = await authFetch(`${REPORT_API}/drop-budgets/history?drop_name=${encodeURIComponent(currentDrop)}&limit=50`).then(r => r.json());
    const rows = data.history || [];
    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="5" class="px-3 py-4 text-center text-slate-400 text-xs">No history yet.</td></tr>`;
      return;
    }
    body.innerHTML = rows.map(r => {
      const date = r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';
      const typeClass = r.change_type === 'delete' ? 'text-rose-600' : r.change_type === 'create' ? 'text-emerald-600' : 'text-slate-500';
      return `<tr class="border-b border-slate-50 hover:bg-slate-50">
        <td class="px-3 py-2 text-slate-500">${date}</td>
        <td class="px-3 py-2 font-medium">${formatGroupLabel(r.department || r.category_group || '')}</td>
        <td class="px-3 py-2 text-right">${formatCurrency(r.amount)}</td>
        <td class="px-3 py-2 ${typeClass}">${r.change_type || '—'}</td>
        <td class="px-3 py-2 text-slate-400">${r.changed_by || '—'}</td>
      </tr>`;
    }).join('');
  } catch (err) {
    body.innerHTML = `<tr><td colspan="5" class="px-3 py-4 text-center text-rose-400 text-xs">Failed to load history.</td></tr>`;
  }
}

// ---- New drop modal ----

function showNewDropModal() {
  document.getElementById('new-drop-modal').classList.remove('hidden');
  document.getElementById('new-drop-name').focus();
  document.getElementById('new-drop-error').classList.add('hidden');
  document.getElementById('new-drop-name').value = '';
  document.getElementById('new-drop-number').value = '';
  document.getElementById('new-drop-season').value = '';
  document.getElementById('new-drop-launch').value = '';
  document.getElementById('new-drop-desc').value = '';
}

function hideNewDropModal() {
  document.getElementById('new-drop-modal').classList.add('hidden');
}

async function createDrop() {
  const name = document.getElementById('new-drop-name').value.trim();
  const dropNum = document.getElementById('new-drop-number').value.trim();
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
      body: JSON.stringify({ drop_name: name, description: desc || null, launch_date: launch || null, season: season || null, drop_number: dropNum ? parseInt(dropNum, 10) : null })
    });
    const data = await r.json();
    if (!r.ok || !data.success) throw new Error(data.error || 'Failed to create drop');

    hideNewDropModal();
    await loadDropList();
    // Select the newly created drop
    const sel = document.getElementById('drop-select');
    // Find the option by value (drop_name)
    const matchOpt = Array.from(sel.options).find(o => o.value === name);
    if (matchOpt) {
      sel.value = name;
      onDropChange();
    }
  } catch (err) {
    errEl.textContent = err.message || 'Failed to create drop.';
    errEl.classList.remove('hidden');
  }
}

async function archiveCurrentDrop() {
  if (!currentDrop) return;
  if (!confirm(`Archive "${currentDrop}"? It will be hidden from drop lists but all data is preserved.`)) return;
  try {
    const sel = document.getElementById('drop-select');
    const opt = sel ? Array.from(sel.options).find(o => o.value === currentDrop) : null;
    const dropId = opt?.dataset?.dropId;
    if (!dropId) { alert('Cannot find drop ID — try refreshing the page.'); return; }
    const r = await authFetch(`/api/meta/drops/${dropId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: false })
    });
    const data = await r.json();
    if (data.success) {
      showEmptyState();
      await loadDropList();
    } else {
      alert('Error: ' + (data.error || 'unknown'));
    }
  } catch (e) {
    alert('Error: ' + e.message);
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
