const API = '/api';
const fmt = n => n == null ? '—' : '&#8377;' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const fmtN = n => Number(n || 0).toLocaleString('en-IN');

function authFetch(url, opts = {}) {
    return fetch(url, Object.assign({ credentials: 'include' }, opts));
}

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    if (window.sessionReady) {
        window.sessionReady.then(loadDashboard).catch(loadDashboard);
    } else {
        loadDashboard();
    }
});

document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key.toLowerCase() === 'u') location.href = 'upload.html';
    if (e.key.toLowerCase() === 'd') location.href = 'documents.html';
    if (e.key.toLowerCase() === 'r') location.href = 'reports.html';
});

async function loadDashboard() {
    const now  = new Date();
    const mStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
    const mEnd   = now.toISOString().split('T')[0];

    // Indian FY: April 1 → March 31
    const fyYear  = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const fyStart = `${fyYear}-04-01`;

    // Fire all requests in parallel
    const [docsData, pl, ytdPL, payDash, drops, trend] = await Promise.all([
        authFetch(`${API}/documents`).then(r => r.json()).catch(() => ({})),
        authFetch(`${API}/reports/profit-loss?start_date=${mStart}&end_date=${mEnd}`).then(r => r.json()).catch(() => ({})),
        authFetch(`${API}/reports/profit-loss?start_date=${fyStart}&end_date=${mEnd}`).then(r => r.json()).catch(() => ({})),
        authFetch(`${API}/payments/dashboard`).then(r => r.json()).catch(() => ({})),
        authFetch(`${API}/meta/drops`).then(r => r.json()).catch(() => ({})),
        authFetch(`${API}/reports/trend?months=6`).then(r => r.json()).catch(() => ({})),
    ]);

    renderDocStats(docsData, mStart);
    renderPLSnapshot(pl, mStart, mEnd, ytdPL, fyStart);
    renderPayablesStrip(payDash);
    renderRecentDocs(docsData);
    renderDropStrip(drops);
    renderMiniTrend(trend);
    loadWatchdog();
}

// ── Doc stats ─────────────────────────────────────────────────────────────────
function renderDocStats(data, mStart) {
    const docs = data.documents || [];
    const msDate = new Date(mStart);
    const thisMonth = docs.filter(d => new Date(d.uploaded_at) >= msDate).length;
    const pending   = docs.filter(d => d.status === 'uploaded' || d.status === 'manual_required').length;
    setText('total-docs',   docs.length);
    setText('month-docs',   thisMonth);
    setText('pending-docs', pending);
}

// ── This-month P&L snapshot ───────────────────────────────────────────────────
function renderPLSnapshot(d, start, end, ytd, fyStart) {
    const label = new Date(start).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    setText('pl-period', label);

    if (!d.success) {
        setText('pl-net-sales', '—');
        setText('pl-gross-profit', '—');
        setText('pl-cm1', '—');
        setText('pl-ebitda', '—');
        // Show YTD row even if month failed
        renderYTD(ytd, fyStart);
        return;
    }

    const ns     = d.net_sales     || 0;
    const gp     = d.gross_profit  || 0;
    const cm1    = d.cm1           || 0;
    const ebitda = d.ebitda        || 0;

    setHTML('pl-net-sales',    fmt(ns));
    setHTML('pl-gross-profit', fmt(gp));
    setHTML('pl-cm1',          fmt(cm1));
    setHTML('pl-ebitda',       fmt(ebitda));

    const gpPct  = ns ? (gp / ns * 100).toFixed(1) : null;
    const cm1Pct = ns ? (cm1 / ns * 100).toFixed(1) : null;
    const ebPct  = ns ? (ebitda / ns * 100).toFixed(1) : null;
    setText('pl-gp-pct',     gpPct  ? gpPct  + '% GM' : '');
    setText('pl-cm1-pct',    cm1Pct ? cm1Pct + '% CM' : '');
    setText('pl-ebitda-pct', ebPct  ? ebPct  + '% margin' : '');

    const badge = document.getElementById('pl-badge');
    if (badge) {
        if (ebitda >= 0) { badge.textContent = 'EBITDA +'; badge.className = 'px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700'; }
        else             { badge.textContent = 'EBITDA −'; badge.className = 'px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-600'; }
    }

    // Spend breakdown bar
    const cogsAmt  = d.cogs?.total        || 0;
    const fulAmt   = d.fulfilment?.total  || 0;
    const mktAmt   = d.marketing?.total   || 0;
    const opexAmt  = d.opex?.total        || 0;
    const totalExp = cogsAmt + fulAmt + mktAmt + opexAmt;

    if (totalExp > 0) {
        const bar = document.getElementById('spend-bar');
        if (bar) {
            const pct = v => Math.round(v / totalExp * 100);
            bar.innerHTML = `
                <div class="flex rounded-lg overflow-hidden h-3 w-full">
                    <div class="bg-indigo-500" style="width:${pct(cogsAmt)}%" title="COGS ${fmt(cogsAmt)}"></div>
                    <div class="bg-blue-400"   style="width:${pct(fulAmt)}%"  title="Fulfillment ${fmt(fulAmt)}"></div>
                    <div class="bg-violet-400" style="width:${pct(mktAmt)}%"  title="Marketing ${fmt(mktAmt)}"></div>
                    <div class="bg-slate-300"  style="width:${pct(opexAmt)}%" title="Operations ${fmt(opexAmt)}"></div>
                </div>
                <div class="flex gap-4 mt-2 text-xs text-slate-500 flex-wrap">
                    <span><span class="inline-block w-2 h-2 rounded-full bg-indigo-500 mr-1"></span>COGS ${fmt(cogsAmt)}</span>
                    <span><span class="inline-block w-2 h-2 rounded-full bg-blue-400 mr-1"></span>Fulfilment ${fmt(fulAmt)}</span>
                    <span><span class="inline-block w-2 h-2 rounded-full bg-violet-400 mr-1"></span>Marketing ${fmt(mktAmt)}</span>
                    <span><span class="inline-block w-2 h-2 rounded-full bg-slate-300 mr-1"></span>Operations ${fmt(opexAmt)}</span>
                </div>`;
        }
    }

    renderYTD(ytd, fyStart);
}

function renderYTD(ytd, fyStart) {
    const el = document.getElementById('ytd-strip');
    if (!el || !ytd || !ytd.success) return;
    const fyLabel = fyStart ? new Date(fyStart).toLocaleString('en-IN', { month: 'short', year: 'numeric' }) : 'FY';
    const ns   = ytd.net_sales    || 0;
    const gp   = ytd.gross_profit || 0;
    const eb   = ytd.ebitda       || 0;
    const gpPct = ns ? (gp / ns * 100).toFixed(1) : '—';
    const ebPct = ns ? (eb / ns * 100).toFixed(1) : '—';
    el.innerHTML = `
        <div class="flex items-center gap-1 text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-2">
            <i class="fas fa-calendar-alt"></i> FY to date (from ${fyLabel})
        </div>
        <div class="flex gap-4 flex-wrap">
            <div><span class="text-xs text-slate-500">Net Sales</span><br><span class="text-sm font-bold text-slate-800">${fmt(ns)}</span></div>
            <div><span class="text-xs text-slate-500">Gross Profit</span><br><span class="text-sm font-bold text-blue-600">${fmt(gp)}</span> <span class="text-xs text-slate-400">${gpPct}%</span></div>
            <div><span class="text-xs text-slate-500">EBITDA</span><br><span class="text-sm font-bold ${eb >= 0 ? 'text-emerald-600' : 'text-red-500'}">${fmt(eb)}</span> <span class="text-xs text-slate-400">${ebPct}%</span></div>
        </div>`;
    el.classList.remove('hidden');
}

// ── Payables strip ────────────────────────────────────────────────────────────
function renderPayablesStrip(d) {
    const overdue = (d.overdue || []).length;
    const week    = d.forecast?.next_7_days  || 0;
    const month   = d.forecast?.next_30_days || 0;
    setHTML('pay-overdue', overdue > 0 ? `<span class="text-red-600 font-bold">${overdue}</span>` : '0');
    setHTML('pay-week',  fmt(week));
    setHTML('pay-month', fmt(month));
}

// ── Recent docs ───────────────────────────────────────────────────────────────
function renderRecentDocs(data) {
    const container = document.getElementById('recent-documents');
    if (!container) return;
    const docs = (data.documents || []).slice(0, 6);

    if (!docs.length) {
        container.innerHTML = `<div class="text-center py-8 text-slate-400"><i class="fas fa-inbox text-3xl mb-2"></i><p class="text-sm">No documents yet</p><a href="upload.html" class="text-indigo-600 text-sm mt-1 inline-block">Upload your first bill →</a></div>`;
        return;
    }

    container.innerHTML = docs.map(doc => {
        const vendor  = doc.bill_vendor_name || doc.vendor_name || doc.file_name || '—';
        const group   = doc.bill_category_group || doc.category_group || '';
        const amount  = doc.total_amount || doc.bill_total_amount;
        const amtStr  = amount ? fmt(amount) : '';
        const STATUS_MAP = { uploaded: ['Pending', 'bg-amber-100 text-amber-700'], processed: ['Done', 'bg-emerald-100 text-emerald-700'], manual_required: ['Review', 'bg-orange-100 text-orange-700'], error: ['Error', 'bg-red-100 text-red-600'] };
        const [statusLabel, statusCls] = STATUS_MAP[doc.status] || ['—', 'bg-slate-100 text-slate-500'];
        const icon = doc.file_type?.includes('pdf') ? 'fa-file-pdf text-red-400' : 'fa-file-image text-blue-400';
        return `
        <div class="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 transition cursor-pointer" onclick="location.href='documents.html'">
            <i class="fas ${icon} text-lg w-5 shrink-0"></i>
            <div class="flex-1 min-w-0">
                <p class="font-medium text-slate-800 text-sm truncate">${vendor}</p>
                <div class="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                    ${group ? `<span class="font-medium text-slate-500">${group}</span>` : ''}
                    ${amtStr ? `<span class="font-semibold text-slate-700">${amtStr}</span>` : ''}
                </div>
            </div>
            <span class="text-xs font-medium px-2 py-0.5 rounded-full ${statusCls} shrink-0">${statusLabel}</span>
        </div>`;
    }).join('');
}

// ── Drop strip ────────────────────────────────────────────────────────────────
function renderDropStrip(data) {
    const container = document.getElementById('drop-strip');
    if (!container) return;
    const drops = (data.drops || []).filter(d => d.is_active).slice(0, 4);
    if (!drops.length) { container.innerHTML = '<p class="text-xs text-slate-400 col-span-4">No active drops</p>'; return; }
    container.innerHTML = drops.map(d => `
        <a href="drop.html?drop=${encodeURIComponent(d.drop_name)}" class="border border-slate-200 rounded-xl p-4 hover:border-indigo-300 hover:bg-indigo-50/50 transition block">
            <div class="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-1">Drop</div>
            <div class="font-bold text-slate-900 text-sm truncate">${d.drop_name}</div>
            ${d.launch_date ? `<div class="text-xs text-slate-400 mt-1"><i class="fas fa-calendar mr-1"></i>${new Date(d.launch_date).toLocaleDateString('en-IN', {day:'numeric',month:'short'})}</div>` : ''}
        </a>`).join('');
}

// ── Mini trend sparkline ───────────────────────────────────────────────────────
function renderMiniTrend(data) {
    const months = data.months || [];
    const wrap = document.getElementById('mini-trend');
    const bars = document.getElementById('mini-trend-bars');
    if (!bars || !months.length) return;
    const maxSales = Math.max(...months.map(m => m.net_sales), 1);
    bars.innerHTML = months.map(m => {
        const pct = Math.round(m.net_sales / maxSales * 100);
        const isPos = m.ebitda >= 0;
        return `<div class="flex flex-col items-center flex-1 gap-0.5" title="${m.label}: ${fmt(m.net_sales).replace(/&#8377;/,'₹')} sales">
            <div style="height:${pct}%;min-height:2px;width:100%;background:${isPos ? '#6366f1' : '#e2e8f0'};border-radius:2px 2px 0 0"></div>
            <span class="text-[9px] text-slate-400">${m.label.split(' ')[0]}</span>
        </div>`;
    }).join('');
    wrap.classList.remove('hidden');
}

// ── Watchdog ──────────────────────────────────────────────────────────────────
async function loadWatchdog(silent) {
    const container = document.getElementById('watchdog-list');
    if (!container) return;
    if (!silent) container.innerHTML = `<div class="text-xs text-slate-400 px-3 py-2">Running checks…</div>`;
    try {
        const [anomaly, alerts] = await Promise.all([
            authFetch(`${API}/brain/watchdog`).then(r => r.json()),
            authFetch(`${API}/brain/alerts?status=open&limit=8`).then(r => r.json()),
        ]);
        renderWatchdog(anomaly, alerts.alerts || []);
    } catch (err) {
        container.innerHTML = `<div class="text-xs text-red-400 px-3 py-2">Watchdog unavailable</div>`;
    }
}

async function refreshWatchdog() {
    const container = document.getElementById('watchdog-list');
    if (container) container.innerHTML = `<div class="text-xs text-slate-400 px-3 py-2">Re-running…</div>`;
    try { await authFetch(`${API}/brain/alerts/run`, { method: 'POST' }); } catch (_) {}
    loadWatchdog(true);
}

function renderWatchdog(data, alerts) {
    const container = document.getElementById('watchdog-list');
    if (!container) return;
    const summary = data.summary || {};
    const checks = [
        { key: 'duplicates',    label: 'Duplicate bills',      icon: 'fa-copy',           href: 'documents.html',                        items: (data.duplicates    || []).slice(0,2).map(d => d.vendor_name || 'Vendor') },
        { key: 'stale_manual',  label: 'Stale reviews 48h+',   icon: 'fa-hourglass-half', href: 'documents.html?status=manual_required', items: (data.stale_manual  || []).slice(0,2).map(d => d.file_name || 'Doc') },
        { key: 'aged_unpaid',   label: 'Unpaid > 30d',         icon: 'fa-calendar-xmark', href: 'payables.html',                         items: (data.aged_unpaid   || []).slice(0,2).map(b => (b.vendor_name || 'Vendor') + ' · ' + fmt(b.total_amount)) },
        { key: 'uncategorized', label: 'Uncategorised bills',   icon: 'fa-tag',            href: 'documents.html?filter_group=none',      items: (data.uncategorized || []).slice(0,2).map(b => (b.vendor_name || 'Vendor') + ' · ' + fmt(b.total_amount)) },
    ];
    const checksHtml = checks.map(c => {
        const count = summary[c.key] ?? c.items.length;
        const ok = count === 0;
        const color = ok ? 'text-emerald-600' : 'text-rose-600';
        const badge = ok ? '✓' : count;
        const subItems = (!ok && c.items.length)
            ? `<div class="mt-1 pl-5 space-y-0.5">${c.items.map(i => `<div class="text-[10px] text-slate-400 truncate">${i}</div>`).join('')}</div>`
            : '';
        const row = `<div class="py-2 border-b border-slate-100 last:border-0">
            <div class="flex items-center justify-between">
                <span class="text-xs text-slate-600"><i class="fas ${c.icon} w-4 text-slate-400 mr-1"></i>${c.label}</span>
                <span class="text-xs font-bold ${color}">${badge}</span>
            </div>${subItems}
        </div>`;
        return ok ? row : `<a href="${c.href}" class="block hover:bg-slate-50 rounded -mx-1 px-1 transition">${row}</a>`;
    }).join('');
    const alertsHtml = alerts.length
        ? alerts.map(a => `<div class="text-xs px-3 py-2 rounded-lg ${a.severity === 'critical' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'} mb-1">
            <span class="font-semibold">${(a.alert_type||'').replace(/_/g,' ')}</span> — ${a.message || ''}
          </div>`).join('')
        : `<div class="text-xs text-emerald-600 px-1">All alerts cleared</div>`;

    container.innerHTML = checksHtml + `<div class="pt-3 mt-1">${alertsHtml}</div>`;
}

// ── Utils ─────────────────────────────────────────────────────────────────────
function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function setHTML(id, val) { const el = document.getElementById(id); if (el) el.innerHTML = val; }
