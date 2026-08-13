const API_URL = '/api';

const CATEGORY_GROUPS = {
    COGS: [
        { value: 'fabric',          label: 'Fabric & Raw Materials' },
        { value: 'manufacturing',   label: 'Manufacturing / Job Work' },
        { value: 'embroidery',      label: 'Embroidery & Embellishment' },
        { value: 'washing',         label: 'Washing & Finishing' },
        { value: 'trims',           label: 'Trims & Accessories' },
        { value: 'packaging',       label: 'Packaging' },
        { value: 'quality',         label: 'Quality Inspection' },
        { value: 'quality check',   label: 'Quality Inspection' },
        { value: 'inbound_freight', label: 'Inbound Freight' },
        { value: 'inbound freight', label: 'Inbound Freight' },
    ],
    FULFILLMENT: [
        { value: 'shipping',         label: 'Shipping & Courier' },
        { value: 'logistics',        label: 'Shipping & Courier' },
        { value: 'warehousing',      label: 'Warehousing & Storage' },
        { value: 'returns',          label: 'Returns & Reverse Logistics' },
        { value: 'commission',       label: 'Marketplace Commission' },
        { value: 'gateway',          label: 'Payment Gateway' },
        { value: 'payment gateway',  label: 'Payment Gateway' },
        { value: 'cod',              label: 'COD Charges' },
    ],
    MARKETING: [
        { value: 'marketing',        label: 'Digital Ads (Meta / Google)' },
        { value: 'ads',              label: 'Digital Ads (Meta / Google)' },
        { value: 'influencer',       label: 'Influencer & Gifting' },
        { value: 'content',          label: 'Content & Photography' },
        { value: 'content creation', label: 'Content & Photography' },
        { value: 'platform_fees',    label: 'Platform Fees / Shopify' },
        { value: 'platform fees',    label: 'Platform Fees / Shopify' },
        { value: 'pr',               label: 'PR & Events' },
        { value: 'affiliate',        label: 'Affiliate' },
    ],
    OPERATIONS: [
        { value: 'rent',             label: 'Rent & Workspace' },
        { value: 'salary',           label: 'Salaries & Wages' },
        { value: 'contractor',       label: 'Contractor / Freelancer' },
        { value: 'software',         label: 'Software & Subscriptions' },
        { value: 'travel',           label: 'Travel & Conveyance' },
        { value: 'bank_charges',     label: 'Bank Charges' },
        { value: 'bank charges',     label: 'Bank Charges' },
        { value: 'legal',            label: 'Legal & Professional' },
        { value: 'compliance',       label: 'GST Filing & Compliance' },
        { value: 'insurance',        label: 'Insurance' },
        { value: 'utilities',        label: 'Utilities & Electricity' },
        { value: 'food_meals',       label: 'Food & Meals' },
        { value: 'food',             label: 'Food & Meals' },
        { value: 'misc',             label: 'Miscellaneous' },
    ],
};

const GROUP_LABELS = {
    COGS:        'COGS / Purchase',
    FULFILLMENT: 'Fulfilment',
    MARKETING:   'Marketing',
    OPERATIONS:  'Operations',
};
const VERIFICATION_FILTER_OPTIONS = [
    { key: 'all', label: 'All', countKey: 'total' },
    { key: 'needs_review', label: 'Needs review', countKey: 'needs_review' },
    { key: 'verified', label: 'Verified', countKey: 'verified' },
    { key: 'missing_date', label: 'Missing date', countKey: 'missing_date' },
    { key: 'missing_total', label: 'Missing total', countKey: 'missing_total' },
    { key: 'low_quality', label: 'Low quality', countKey: 'low_quality' },
    { key: 'processing', label: 'Processing', countKey: 'processing' },
    { key: 'unverified', label: 'Unverified', countKey: 'unverified' }
];
let allDocuments = [];
let filteredDocuments = [];
let verificationFilter = 'all';
let verificationSummary = null;
let currentProcessingDoc = null;
let currentManualDoc = null;
let manualLineItems = [];
let calendarCursor = new Date();
let filtersCollapsed = false;
let calendarCollapsed = false;
let useBillDateMode = true; // true = bill_date, false = uploaded_at
let currentDocumentDetail = null;
let currentBillItems = [];
const bus = window.store || { subscribe: () => {}, emit: () => {}, EVENTS: { DATA_CHANGED: 'DATA_CHANGED' } };

// ── Meta cache for line-item editing ────────────────────────────────────────
let _metaCoa   = null;   // [{coa_account_id, account_code, account_name}]
let _metaDepts = null;   // [{department_id, department_name}]
let _metaDrops = null;   // [{drop_id, drop_name}]
let _allTags   = null;   // [{tag_id, tag_name, tag_group, color}]

async function _ensureMeta() {
    const needed = [];
    if (!_metaCoa)   needed.push(authFetch('/api/meta/coa_accounts').then(r => r.json()).then(d => { _metaCoa   = d.accounts || []; }));
    if (!_metaDepts) needed.push(authFetch('/api/meta/departments').then(r => r.json()).then(d => { _metaDepts = d.departments || []; }));
    if (!_metaDrops) needed.push(authFetch('/api/meta/drops?all=1').then(r => r.json()).then(d => { _metaDrops = d.drops || []; }));
    if (!_allTags)   needed.push(authFetch('/api/tags').then(r => r.json()).then(d => { _allTags   = d.tags || []; }));
    if (needed.length) await Promise.all(needed);
}

function authFetch(url, options = {}) {
    const opts = Object.assign({ credentials: 'include' }, options);
    return fetch(url, opts);
}

async function saveLineItemField(itemId, payload) {
    try {
        const r = await authFetch(`/api/bill-items/${itemId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const d = await r.json();
        if (!d.success) throw new Error(d.error || 'Save failed');
        // Refresh quality badge on item row
        _refreshItemStatusBadge(itemId, d.item);
        return d;
    } catch (e) {
        console.error('saveLineItemField', e);
        alert('Could not save: ' + e.message);
    }
}

function _refreshItemStatusBadge(itemId, item) {
    const row = document.querySelector(`tr[data-item-id="${itemId}"]`);
    if (!row) return;
    const badge = row.querySelector('.item-status-badge');
    if (badge) badge.outerHTML = _postingBadge(item);
}

function _postingBadge(item) {
    if (!item.is_postable) return `<span class="item-status-badge text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Non-postable</span>`;
    if (item.posting_status === 'posted') return `<span class="item-status-badge text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Posted</span>`;
    const missingDims = !item.coa_account_id || !item.department_id || !item.drop_id;
    if (missingDims) return `<span class="item-status-badge text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">Missing dims</span>`;
    return `<span class="item-status-badge text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Pending post</span>`;
}

async function saveTagsForBill(billId) {
    const checkboxes = document.querySelectorAll('#bill-tags-wrap input[type=checkbox]:checked');
    const tag_ids = Array.from(checkboxes).map(c => parseInt(c.value, 10));
    try {
        const r = await authFetch(`/api/tags/bill/${billId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tag_ids })
        });
        const d = await r.json();
        if (!d.success) throw new Error(d.error);
        const wrap = document.getElementById('tags-save-indicator');
        if (wrap) { wrap.textContent = 'Saved'; wrap.className = 'text-xs text-emerald-600 ml-2'; setTimeout(() => { if(wrap) wrap.textContent = ''; }, 2000); }
    } catch (e) {
        alert('Could not save tags: ' + e.message);
    }
}

function getCategory(doc) {
    return doc.bill_category
        || doc.document_category
        || doc.category
        || doc.gemini_data?.category
        || '—';
}

function getCategoryGroup(doc) {
    return doc.bill_category_group || doc.category_group || doc.gemini_data?.category_group || null;
}

function getVerificationStatus(doc) {
    if (doc.verification && doc.verification.status) return doc.verification.status;
    return doc.status === 'processed' ? 'unverified' : 'processing';
}

function docHasBillDate(doc) {
    if (doc.bill_date) return true;
    return Boolean(doc.gemini_data?.bill_date);
}

function docHasTotal(doc) {
    const values = [
        doc.bill_total_amount,
        doc.total_amount,
        doc.gemini_data?.amounts?.total
    ];
    return values.some((value) => {
        if (value === null || value === undefined || value === '') return false;
        const num = Number(value);
        return !Number.isNaN(num) && num > 0;
    });
}

function docQualityScore(doc) {
    if (doc.verification && doc.verification.quality_score != null) {
        return doc.verification.quality_score;
    }
    if (doc.quality_score != null) return Number(doc.quality_score);
    return null;
}

function docIsLowQuality(doc) {
    const quality = docQualityScore(doc);
    return quality != null && quality < 60;
}

function docIsMissingDate(doc) {
    return !docHasBillDate(doc);
}

function docIsMissingTotal(doc) {
    return !docHasTotal(doc);
}

function docMatchesVerificationFilter(doc) {
    const status = getVerificationStatus(doc);
    if (verificationFilter === 'all') return true;
    if (verificationFilter === 'needs_review') return status === 'needs_review';
    if (verificationFilter === 'verified') return status === 'verified';
    if (verificationFilter === 'processing') return status === 'processing';
    if (verificationFilter === 'unverified') return status === 'unverified';
    if (verificationFilter === 'missing_date') return docIsMissingDate(doc);
    if (verificationFilter === 'missing_total') return docIsMissingTotal(doc);
    if (verificationFilter === 'low_quality') return docIsLowQuality(doc);
    return true;
}

function encodeTooltip(value) {
    if (!value) return '';
    return value.replace(/"/g, '&quot;');
}

function escapeHTML(value) {
    if (value === null || value === undefined) return '';
    return value
        .toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function buildVerificationTooltip(verification) {
    if (!verification) return 'Verification data unavailable';
    const lines = [];
    if (verification.reason) lines.push(`Reason: ${verification.reason}`);
    lines.push(`Quality: ${verification.quality_score ?? '—'}`);
    if (verification.bill_date_locked) {
        lines.push(`Bill date: locked (${verification.bill_date_source || 'manual'})`);
    } else {
        lines.push(`Bill date source: ${verification.bill_date_source || '—'}`);
    }
    if (verification.bill_date_evidence) {
        lines.push(`↳ ${verification.bill_date_evidence}`);
    }
    if (verification.total_locked) {
        lines.push(`Total: locked (${verification.total_source || 'manual'})`);
    } else {
        lines.push(`Total source: ${verification.total_source || '—'}`);
    }
    if (verification.total_evidence) {
        lines.push(`↳ ${verification.total_evidence}`);
    }
    return lines.join('\n');
}

function verificationBadge(doc) {
    const verification = doc.verification || null;
    const tooltip = encodeTooltip(buildVerificationTooltip(verification));
    const base = 'px-2 py-1 rounded text-xs font-medium whitespace-nowrap';
    const badgeMap = {
        verified: { cls: 'bg-green-100 text-green-800', label: 'Verified ✅' },
        needs_review: { cls: 'bg-amber-100 text-amber-800', label: 'Needs review ⚠️' },
        processing: { cls: 'bg-slate-100 text-slate-700', label: 'Processing ⏳' },
        unverified: { cls: 'bg-gray-100 text-gray-700', label: 'Unverified' }
    };
    const status = getVerificationStatus(doc);
    const badge = badgeMap[status] || badgeMap.unverified;
    return `<span class="${base} ${badge.cls}" title="${tooltip}">${badge.label}</span>`;
}

function formatLabel(value) {
    const v = value || '—';
    if (v === '—') return v;
    return v.toString().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function setSelectValue(id, value, fallback = '') {
    const el = document.getElementById(id);
    if (!el) return false;
    const normalized = (value || '').toString().trim();
    if (!normalized) {
        el.value = fallback;
        return false;
    }
    const match = Array.from(el.options).find(opt => opt.value.toUpperCase() === normalized.toUpperCase());
    if (match) {
        el.value = match.value;
        return true;
    }
    el.value = fallback;
    return false;
}

function getPayment(doc) {
    // Use manual/approved payment first, then the original upload selection
    return doc.bill_payment_method || doc.document_payment_method || doc.payment_method || '—';
}

function getDocDate(doc) {
    if (!useBillDateMode) return doc.uploaded_at;
    // Prefer the bill_date (actual invoice date); fall back to AI guess; finally uploaded_at
    return doc.bill_date || doc.gemini_data?.bill_date || doc.uploaded_at;
}

async function loadDocuments() {
    try {
        const response = await authFetch(`${API_URL}/documents`);
        const data = await response.json();
        
        if (data.success) {
            allDocuments = data.documents;
            filteredDocuments = allDocuments;
            populateFilterDropdowns(allDocuments);
            // Apply pending drop filter from URL param (set before data loaded)
            if (window._pendingDropFilter) {
                const el = document.getElementById('filter-drop');
                if (el) el.value = window._pendingDropFilter;
                window._pendingDropFilter = null;
            }
            displayDocuments(filteredDocuments);
            await loadVerificationSummary();
            updateDocCount();
            renderCalendar();
        }
    } catch (error) {
        console.error('Error loading documents:', error);
    }
}

async function loadVerificationSummary() {
    try {
        const response = await authFetch(`${API_URL}/documents/verification/summary`);
        const data = await response.json();
        if (data.success) {
            verificationSummary = data.summary || null;
        }
    } catch (error) {
        console.error('Error loading verification summary:', error);
        verificationSummary = null;
    }
    renderVerificationFilters();
}

function renderVerificationFilters() {
    const container = document.getElementById('verification-filter-chips');
    if (!container) return;
    const summary = verificationSummary || {};
    const buttons = VERIFICATION_FILTER_OPTIONS.map((option) => {
        const countValue = option.countKey === 'total'
            ? (summary.total ?? allDocuments.length)
            : (summary[option.countKey] ?? 0);
        const isActive = verificationFilter === option.key;
        const base = 'px-3 py-1 rounded-full text-xs font-medium border transition';
        const activeCls = isActive ? 'bg-indigo-600 text-white border-indigo-600 shadow' : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300';
        return `<button type="button" class="${base} ${activeCls}" data-verification-filter="${option.key}" onclick="setVerificationFilter('${option.key}')">${option.label} <span class="ml-1 font-semibold">${countValue}</span></button>`;
    }).join('');
    container.innerHTML = buttons;
}

function setVerificationFilter(key) {
    verificationFilter = key;
    renderVerificationFilters();
    filterDocuments();
}

function getVerificationFilterLabel(key) {
    const option = VERIFICATION_FILTER_OPTIONS.find((opt) => opt.key === key);
    return option ? option.label : key;
}

function displayDocuments(documents) {
    renderTable(documents);
}

async function triggerRerunAI() {
    const choice = await showAIActionModal();
    if (!choice) return;

    if (choice === 'categorize') {
        await runRecategorize();
    } else if (choice === 'both') {
        await runRecategorize();
        let limit = prompt('How many documents for AI re-extraction? (1–500)', '100');
        if (!limit) return;
        limit = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);
        await runFullReprocess(limit);
    } else {
        let limit = prompt('How many documents to reprocess? (1–500)', '50');
        if (!limit) return;
        limit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 500);
        await runFullReprocess(limit);
    }
}

async function runRecategorize() {
    const btn = document.getElementById('rerun-ai-btn');
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Fixing categories…</span>';
    try {
        const resp = await authFetch(`${API_URL}/documents/recategorize`, { method: 'POST' });
        const data = await resp.json();
        if (!resp.ok || data.error) throw new Error(data.error || 'Failed');
        showToast(`✓ Recategorized ${data.updated} of ${data.total} bills to correct CoA accounts. Refresh Reports to see updated P&L.`);
        await loadDocuments();
    } catch (err) {
        alert('Recategorize failed: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = original;
    }
}

async function runFullReprocess(limit) {
    const btn = document.getElementById('rerun-ai-btn');
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>AI running…</span>';
    try {
        const resp = await authFetch(`${API_URL}/documents/reprocess`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ limit, scope: 'all' })
        });
        const data = await resp.json();
        if (!resp.ok || data.error) throw new Error(data.error || 'Failed to re-run AI');
        showToast([
            `✓ AI re-run done.`,
            `Processed: ${data.processed}/${data.scanned}`,
            `Dates updated: ${data.dates_updated}`,
            `Still missing: ${data.dates_still_missing}`,
            `Flagged for review: ${data.flagged_manual}`
        ].join('  ·  '));
        await loadDocuments();
    } catch (error) {
        alert(`AI re-run failed: ${error.message}`);
    } finally {
        btn.disabled = false;
        btn.innerHTML = original;
    }
}

function showAIActionModal() {
    return new Promise(resolve => {
        // Remove any existing modal
        const old = document.getElementById('ai-action-modal');
        if (old) old.remove();

        const modal = document.createElement('div');
        modal.id = 'ai-action-modal';
        modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:9999`;
        modal.innerHTML = `
          <div style="background:#fff;border-radius:16px;padding:28px;max-width:480px;width:90%;box-shadow:0 24px 60px rgba(0,0,0,.2)">
            <h3 style="font-size:17px;font-weight:700;margin-bottom:6px">AI Actions</h3>
            <p style="font-size:13px;color:#6b7280;margin-bottom:20px">What should AI fix on your bills?</p>

            <div style="display:flex;flex-direction:column;gap:10px">
              <button id="ai-cat-btn" style="text-align:left;padding:14px 16px;border:2px solid #e5e7eb;border-radius:10px;background:#f9fafb;cursor:pointer;font-size:13px">
                <div style="font-weight:700;color:#4f46e5;margin-bottom:3px">⚡ Fix Categories & CoA Mapping</div>
                <div style="color:#6b7280;font-size:12px">Instantly maps all bills to the correct Chart of Accounts (P&L groups, expense codes). No AI call — runs in seconds.</div>
              </button>

              <button id="ai-full-btn" style="text-align:left;padding:14px 16px;border:2px solid #e5e7eb;border-radius:10px;background:#f9fafb;cursor:pointer;font-size:13px">
                <div style="font-weight:700;color:#7c3aed;margin-bottom:3px">🤖 Full AI Re-extraction</div>
                <div style="color:#6b7280;font-size:12px">Re-reads documents with AI to fix missing dates, amounts, vendor names, and then recategorizes. Takes longer.</div>
              </button>

              <button id="ai-both-btn" style="text-align:left;padding:14px 16px;border:2px solid #4f46e5;border-radius:10px;background:#eef2ff;cursor:pointer;font-size:13px">
                <div style="font-weight:700;color:#312e81;margin-bottom:3px">✨ Run Both (Recommended)</div>
                <div style="color:#4338ca;font-size:12px">Fix CoA mapping instantly, then re-read all documents with AI to clean up dates, vendors, and amounts.</div>
              </button>
            </div>

            <div style="margin-top:18px;display:flex;justify-content:flex-end">
              <button id="ai-cancel-btn" style="padding:8px 18px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;cursor:pointer;background:#fff">Cancel</button>
            </div>
          </div>`;
        document.body.appendChild(modal);

        modal.querySelector('#ai-cat-btn').onclick = () => { modal.remove(); resolve('categorize'); };
        modal.querySelector('#ai-full-btn').onclick = () => { modal.remove(); resolve('full'); };
        modal.querySelector('#ai-both-btn').onclick = () => { modal.remove(); resolve('both'); };
        modal.querySelector('#ai-cancel-btn').onclick = () => { modal.remove(); resolve(null); };
        modal.onclick = (e) => { if (e.target === modal) { modal.remove(); resolve(null); } };
    });
}

function showToast(msg) {
    const t = document.getElementById('doc-toast') || (() => {
        const el = document.createElement('div');
        el.id = 'doc-toast';
        el.style.cssText = `position:fixed;bottom:24px;right:24px;background:#111;color:#fff;padding:12px 20px;border-radius:10px;font-size:13px;z-index:9999;display:none;max-width:480px;line-height:1.6`;
        document.body.appendChild(el);
        return el;
    })();
    t.textContent = msg;
    t.style.display = 'block';
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.style.display = 'none'; }, 5000);
}

function payStatusBadge(status) {
    if (!status || status === '—') return '<span class="text-xs text-slate-400">—</span>';
    const map = {
        paid:    'bg-green-100 text-green-700',
        pending: 'bg-amber-100 text-amber-700',
        advance: 'bg-blue-100 text-blue-700'
    };
    const labels = { paid: 'Paid', pending: 'Unpaid', advance: 'Advance' };
    const cls = map[status] || 'bg-slate-100 text-slate-600';
    return `<span class="px-1.5 py-0.5 rounded text-xs font-medium ${cls}">${labels[status] || status}</span>`;
}

function sectionChip(section) {
    if (!section) return '<span class="text-xs text-slate-300">—</span>';
    const map = { Regulars: 'bg-indigo-100 text-indigo-700', Artwear: 'bg-purple-100 text-purple-700', Collectibles: 'bg-rose-100 text-rose-700' };
    return `<span class="px-1.5 py-0.5 rounded text-xs font-medium ${map[section] || 'bg-slate-100 text-slate-600'}">${section}</span>`;
}

function groupChip(grp) {
    const map = {
        COGS:        'bg-orange-100 text-orange-700',
        FULFILLMENT: 'bg-blue-100 text-blue-700',
        MARKETING:   'bg-violet-100 text-violet-700',
        OPERATIONS:  'bg-slate-100 text-slate-600',
    };
    const short = { COGS: 'COGS', FULFILLMENT: 'Fulfil.', MARKETING: 'Mktg', OPERATIONS: 'Ops' };
    const key = (grp || '').toUpperCase();
    if (!key || !map[key]) return '<span class="text-xs text-slate-300">—</span>';
    return `<span class="px-1.5 py-0.5 rounded text-xs font-medium ${map[key]}">${short[key]}</span>`;
}

function renderTable(documents) {
    const body = document.getElementById('documents-table-body');
    if (!body) return;
    if (documents.length === 0) {
        body.innerHTML = `<tr><td colspan="10" class="px-3 py-4 text-center text-gray-500">No documents found</td></tr>`;
        return;
    }
    body.innerHTML = documents.map((doc, idx) => {
        const vendor = doc.bill_vendor_name || doc.vendor_name || doc.gemini_data?.vendor_name || '—';
        const total = doc.total_amount || doc.bill_total_amount || doc.gemini_data?.amounts?.total || 0;
        const billDate = getDocDate(doc);
        const paymentRaw = (getPayment(doc) || '').toUpperCase();
        const paymentMethod = paymentRaw && paymentRaw !== 'UNSPECIFIED' ? formatLabel(paymentRaw.toLowerCase()) : '—';
        const categoryValue = formatLabel(getCategory(doc));
        const grp = getCategoryGroup(doc);
        const fileNumber = `#${String(doc.document_id || idx + 1).padStart(4, '0')}`;
        const section = doc.bill_section || doc.section || null;
        const drop = doc.bill_drop_name || doc.drop_name || null;
        const payStatus = doc.bill_payment_status || doc.payment_status || null;
        const docStatus = getStatusBadge(doc.status);
        const isOverdue = payStatus === 'pending' && doc.bill_payment_due_date && new Date(doc.bill_payment_due_date) < new Date();
        const rowCls = isOverdue ? 'bg-red-50' : 'hover:bg-slate-50';
        const rowBillId = doc.bill_id || doc.document_id;
        const isChecked = bulkSelected.has(rowBillId);
        return `
            <tr class="${rowCls} cursor-pointer border-t border-slate-100" onclick="openBillModal(${doc.document_id})">
                <td class="px-3 py-2 text-center" onclick="event.stopPropagation()">
                    <input type="checkbox" class="row-cb rounded border-slate-300 accent-indigo-600" ${isChecked ? 'checked' : ''} onchange="toggleRowSelect(${rowBillId}, this.checked)">
                </td>
                <td class="px-3 py-2 text-xs text-slate-500">${fileNumber}</td>
                <td class="px-3 py-2 text-sm font-medium text-slate-900">${vendor}</td>
                <td class="px-3 py-2 text-xs text-slate-600">
                    <div class="flex items-center gap-1 flex-wrap">
                        ${groupChip(grp)}
                        ${categoryValue !== '—' ? `<span class="text-slate-500">${categoryValue}</span>` : ''}
                    </div>
                </td>
                <td class="px-3 py-2 text-xs">${sectionChip(section)}</td>
                <td class="px-3 py-2 text-xs text-slate-500">${drop || '—'}</td>
                <td class="px-3 py-2 text-xs text-slate-600">${paymentMethod}</td>
                <td class="px-3 py-2 text-xs">${payStatusBadge(payStatus)}</td>
                <td class="px-3 py-2 text-xs">${docStatus}</td>
                <td class="px-3 py-2 text-right text-sm font-semibold text-slate-900">₹${Number(total || 0).toLocaleString('en-IN')}</td>
                <td class="px-3 py-2 text-xs text-slate-500">${formatDateDisplay(billDate)}</td>
            </tr>
        `;
    }).join('');
}

let selectedDocId = null;
function selectDocument(id) {
    selectedDocId = id;
    const doc = filteredDocuments.find(d => d.document_id === id);
    renderDetail(doc);
}

// ── Bulk selection ────────────────────────────────────────────────────────────
const bulkSelected = new Set();

function toggleRowSelect(billId, checked) {
    if (checked) bulkSelected.add(billId);
    else bulkSelected.delete(billId);
    updateBulkBar();
}

function toggleSelectAll(checked) {
    bulkSelected.clear();
    if (checked) {
        filteredDocuments.forEach(d => {
            const id = d.bill_id || d.document_id;
            if (id) bulkSelected.add(id);
        });
    }
    document.querySelectorAll('.row-cb').forEach(cb => { cb.checked = checked; });
    updateBulkBar();
}

function clearSelection() {
    bulkSelected.clear();
    document.querySelectorAll('.row-cb').forEach(cb => { cb.checked = false; });
    const allCb = document.getElementById('select-all-cb');
    if (allCb) allCb.checked = false;
    updateBulkBar();
}

function updateBulkBar() {
    const bar = document.getElementById('bulk-bar');
    const countEl = document.getElementById('bulk-count');
    if (!bar) return;
    if (bulkSelected.size > 0) {
        bar.classList.remove('hidden');
        countEl.textContent = `${bulkSelected.size} selected`;
    } else {
        bar.classList.add('hidden');
    }
}

async function applyBulkMeta() {
    const group    = document.getElementById('bulk-group')?.value;
    const dropName = document.getElementById('bulk-drop')?.value;
    if (!group && !dropName) { showToast('Select a group or drop first'); return; }
    if (!bulkSelected.size)  { showToast('No bills selected'); return; }
    const body = { bill_ids: Array.from(bulkSelected) };
    if (group)    body.department = group;
    if (dropName) body.drop_name  = dropName;
    try {
        const r = await authFetch('/api/bills/bulk-meta', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }).then(r => r.json());
        if (r.success) {
            const parts = [];
            if (group)    parts.push(group);
            if (dropName) parts.push(dropName);
            showToast(`Updated ${r.updated} bill${r.updated !== 1 ? 's' : ''} → ${parts.join(', ')}`);
            clearSelection();
            await loadDocuments();
        } else {
            showToast('Error: ' + (r.error || 'unknown'));
        }
    } catch (e) {
        showToast('Error: ' + e.message);
    }
}

function applyBulkGroup() { return applyBulkMeta(); }


async function openBillModal(id) {
    const doc = filteredDocuments.find(d => d.document_id === id);
    if (!doc) return;
    selectedDocId = id;
    const modal = document.getElementById('bill-modal');
    const body = document.getElementById('bill-modal-body');
    const titleEl = document.getElementById('bill-modal-title');
    const subEl = document.getElementById('bill-modal-sub');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    titleEl.textContent = 'Loading…';
    subEl.textContent = '';
    body.innerHTML = `<div class="p-8 text-sm text-slate-500 text-center"><i class="fas fa-spinner fa-spin mr-2"></i>Loading bill…</div>`;

    try {
        const detailResp = window.apiFetch
            ? await window.apiFetch(`${API_URL}/documents/${id}`, { method: 'GET' })
            : await authFetch(`${API_URL}/documents/${id}`).then(r => r.json());
        if (!detailResp || detailResp.success === false) {
            body.innerHTML = `<p class="text-red-600 text-sm p-4">Failed to load document.</p>`;
            return;
        }
        currentDocumentDetail = detailResp.document || doc;
        currentBillItems = Array.isArray(currentDocumentDetail.line_items) ? currentDocumentDetail.line_items : [];
        const d = { ...doc, ...currentDocumentDetail };
        const gemData = d.gemini_data || {};

        // ── Core fields ──────────────────────────────────────────────────
        const vendor      = d.bill_vendor_name || d.vendor_name || gemData.vendor_name || '—';
        const billNo      = d.bill_number || gemData.bill_number || '—';
        const billDate    = formatDateDisplay(getDocDate(d));
        const subtotal    = Number(d.bill_subtotal || gemData.amounts?.subtotal || 0);
        const tax         = Number(d.bill_tax_amount || gemData.amounts?.tax || 0);
        const total       = Number(d.bill_total_amount || d.total_amount || gemData.amounts?.total || 0);
        const category    = getCategory(d);
        const grp         = getCategoryGroup(d) || '';
        const grpLabel    = GROUP_LABELS[grp.toUpperCase()] || grp;
        const catLabel    = category && category !== '—'
            ? category.replace(/_/g, ' ').replace(/\b\w/g, x => x.toUpperCase())
            : '—';
        const drop        = d.bill_drop_name || d.drop_name || '—';
        const section     = d.bill_section || d.section || '—';
        const payMethod   = d.bill_payment_method || d.payment_method || '—';
        const payStatus   = d.bill_payment_status || '—';
        const notes       = d.notes || '';
        const fileName    = d.file_name || '';

        // ── Payment status badge ─────────────────────────────────────────
        const payStatusBadge = () => {
            const s = (payStatus || '').toLowerCase();
            if (s === 'paid')    return `<span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700"><i class="fas fa-check-circle"></i> Paid</span>`;
            if (s === 'advance') return `<span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700"><i class="fas fa-clock"></i> Advance Paid</span>`;
            if (s === 'pending') return `<span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-700"><i class="fas fa-exclamation-circle"></i> Unpaid</span>`;
            return `<span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">${payStatus}</span>`;
        };

        // ── AI extraction status ─────────────────────────────────────────
        const extractionStatus = () => {
            if (d.status === 'processed') return `<span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-emerald-50 text-emerald-700"><i class="fas fa-robot"></i> AI Extracted</span>`;
            if (d.status === 'processing') return `<span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-blue-50 text-blue-700"><i class="fas fa-spinner fa-spin"></i> Processing</span>`;
            return `<span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-slate-100 text-slate-500"><i class="fas fa-file"></i> Uploaded</span>`;
        };

        // ── Line items ───────────────────────────────────────────────────
        const lineItemsHtml = currentBillItems.length
            ? `<div class="overflow-auto rounded-xl border border-slate-200">
                <table class="min-w-full text-sm">
                    <thead class="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
                        <tr>
                            <th class="px-4 py-2 text-left">Description</th>
                            <th class="px-4 py-2 text-left">SKU</th>
                            <th class="px-4 py-2 text-right">Amount</th>
                            <th class="px-4 py-2 text-center">Status</th>
                            <th class="px-4 py-2 text-center">Post</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100" id="line-items-tbody">
                        ${currentBillItems.map(item => `
                            <tr class="hover:bg-slate-50" data-item-id="${item.item_id}">
                                <td class="px-4 py-2 max-w-[180px] truncate" title="${escapeHTML(item.description || '')}">${escapeHTML(item.description || '—')}</td>
                                <td class="px-4 py-2 text-slate-500 text-xs">${escapeHTML(item.sku_code || '—')}</td>
                                <td class="px-4 py-2 text-right font-medium">₹${Number(item.amount || 0).toLocaleString('en-IN')}</td>
                                <td class="px-4 py-2 text-center">${_postingBadge(item)}</td>
                                <td class="px-4 py-2 text-center">
                                    ${item.is_postable ? `<button onclick="openItemPostModal(${item.item_id})" class="text-xs text-indigo-600 hover:text-indigo-800 font-medium"><i class="fas fa-edit"></i></button>` : ''}
                                </td>
                            </tr>`).join('')}
                    </tbody>
                </table>
               </div>`
            : '';

        // ── Actions ──────────────────────────────────────────────────────
        const canPreview = canPreviewFile(d.file_type);
        const needsMarkPaid = d.bill_id && payStatus && payStatus !== 'paid';
        const notYetProcessed = d.status !== 'processed';

        titleEl.textContent = vendor;
        subEl.textContent = `${billNo !== '—' ? 'Bill #' + billNo + ' · ' : ''}${billDate}`;

        body.innerHTML = `
        <div class="space-y-5 p-1">

            <!-- Header strip: amount + status badges -->
            <div class="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                    <p class="text-3xl font-bold text-slate-900">₹${total.toLocaleString('en-IN', {maximumFractionDigits:0})}</p>
                    <p class="text-xs text-slate-500 mt-1">${subtotal > 0 ? `Subtotal ₹${subtotal.toLocaleString('en-IN')} + Tax ₹${tax.toLocaleString('en-IN')}` : 'Total amount'}</p>
                </div>
                <div class="flex flex-wrap gap-2 items-center">
                    ${payStatusBadge()}
                    ${extractionStatus()}
                </div>
            </div>

            <!-- Two-column detail grid -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                <div class="flex justify-between border-b border-slate-50 pb-2">
                    <span class="text-slate-500">Vendor</span>
                    <span class="font-medium text-slate-900 text-right">${escapeHTML(vendor)}</span>
                </div>
                <div class="flex justify-between border-b border-slate-50 pb-2">
                    <span class="text-slate-500">Bill number</span>
                    <span class="font-medium text-slate-900">${escapeHTML(billNo)}</span>
                </div>
                <div class="flex justify-between border-b border-slate-50 pb-2">
                    <span class="text-slate-500">Bill date</span>
                    <span class="font-medium text-slate-900">${billDate}</span>
                </div>
                <div class="flex justify-between border-b border-slate-50 pb-2">
                    <span class="text-slate-500">Payment method</span>
                    <span class="font-medium text-slate-900">${escapeHTML(payMethod)}</span>
                </div>
                <div class="flex justify-between border-b border-slate-50 pb-2">
                    <span class="text-slate-500">Category group</span>
                    <span class="font-medium text-slate-900">${escapeHTML(grpLabel || '—')}</span>
                </div>
                <div class="flex justify-between border-b border-slate-50 pb-2">
                    <span class="text-slate-500">Category</span>
                    <span class="font-medium text-slate-900">${escapeHTML(catLabel)}</span>
                </div>
                <div class="flex justify-between border-b border-slate-50 pb-2">
                    <span class="text-slate-500">Drop</span>
                    <span class="font-medium text-slate-900">${escapeHTML(drop)}</span>
                </div>
                <div class="flex justify-between border-b border-slate-50 pb-2">
                    <span class="text-slate-500">Section</span>
                    <span class="font-medium text-slate-900">${escapeHTML(section)}</span>
                </div>
                ${notes ? `
                <div class="flex justify-between border-b border-slate-50 pb-2 sm:col-span-2">
                    <span class="text-slate-500">Notes</span>
                    <span class="font-medium text-slate-900 text-right max-w-xs">${escapeHTML(notes)}</span>
                </div>` : ''}
                <div class="flex justify-between border-b border-slate-50 pb-2 sm:col-span-2">
                    <span class="text-slate-500">Source file</span>
                    <span class="text-slate-600 text-xs">${escapeHTML(fileName)}</span>
                </div>
            </div>

            <!-- Quick Edit (only for bills) -->
            ${d.bill_id ? `<div>
                <button onclick="toggleQuickEdit()" class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-indigo-600 transition-colors">
                    <i id="qe-chevron" class="fas fa-chevron-right text-[10px]"></i> Quick Edit
                </button>
                <div id="quick-edit-panel" class="hidden mt-3 space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs text-slate-500 mb-1">Drop</label>
                            <input id="qe-drop" type="text" list="qe-drop-list" value="${escapeHTML(drop !== '—' ? drop : '')}" placeholder="e.g. Drop 4"
                                class="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                            <datalist id="qe-drop-list"></datalist>
                        </div>
                        <div>
                            <label class="block text-xs text-slate-500 mb-1">Category group</label>
                            <select id="qe-dept" class="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                                <option value="">— keep current —</option>
                                <option value="COGS" ${grp === 'COGS' ? 'selected' : ''}>COGS / Purchase</option>
                                <option value="FULFILLMENT" ${grp === 'FULFILLMENT' ? 'selected' : ''}>Fulfilment</option>
                                <option value="MARKETING" ${grp === 'MARKETING' ? 'selected' : ''}>Marketing</option>
                                <option value="OPERATIONS" ${grp === 'OPERATIONS' ? 'selected' : ''}>Operations</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs text-slate-500 mb-1">Category</label>
                            <input id="qe-cat" type="text" value="${escapeHTML(category !== '—' ? category : '')}" placeholder="e.g. fabric"
                                class="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                        </div>
                        <div>
                            <label class="block text-xs text-slate-500 mb-1">Channel</label>
                            <input id="qe-channel" type="text" value="${escapeHTML(d.channel || d.bill_channel || '')}" placeholder="e.g. instagram"
                                class="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                        </div>
                        <div class="col-span-2">
                            <label class="block text-xs text-slate-500 mb-1">Notes</label>
                            <input id="qe-notes" type="text" value="${escapeHTML(notes)}" placeholder="Internal notes…"
                                class="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <button onclick="submitQuickEdit(${d.bill_id})" class="px-4 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">Save changes</button>
                        <span id="qe-status" class="text-xs text-emerald-600"></span>
                    </div>
                </div>
            </div>` : ''}

            <!-- Tags (only for bills) -->
            ${d.bill_id ? `<div>
                <p class="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-2">
                    Tags
                    <span id="tags-save-indicator" class="text-xs text-emerald-600"></span>
                </p>
                <div id="bill-tags-wrap" class="text-sm text-slate-400 italic">Loading tags…</div>
                <button onclick="saveTagsForBill(${d.bill_id})" class="mt-2 px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Save tags</button>
            </div>` : ''}

            <!-- Line items (if any) -->
            ${lineItemsHtml ? `<div>
                <p class="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Line Items</p>
                ${lineItemsHtml}
            </div>` : ''}

            <!-- Actions -->
            <div class="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                ${canPreview ? `<button onclick="actionPreview(${d.document_id}, '${(fileName).replace(/'/g,'')}', '${d.file_type}')" class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-2"><i class="fas fa-eye"></i>View Document</button>` : ''}
                <button onclick="actionManual(${d.document_id})" class="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-900 flex items-center gap-2"><i class="fas fa-pen"></i>Edit Bill</button>
                ${needsMarkPaid ? `<button onclick="actionMarkPaid(${d.bill_id}, '${(vendor).replace(/'/g,'')}', ${total})" class="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 flex items-center gap-2"><i class="fas fa-check"></i>Mark Paid</button>` : ''}
                ${notYetProcessed && d.can_process !== false ? `<button onclick="actionProcessAI(${d.document_id})" class="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 flex items-center gap-2"><i class="fas fa-robot"></i>Extract with AI</button>` : ''}
                <button onclick="actionDownload(${d.document_id})" class="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 flex items-center gap-2"><i class="fas fa-download"></i>Download</button>
                ${d.can_delete !== false ? `<button onclick="actionDelete(${d.document_id}, ${d.bill_id || 'null'})" class="ml-auto px-4 py-2 bg-rose-50 text-rose-600 rounded-lg text-sm font-medium hover:bg-rose-100 flex items-center gap-2"><i class="fas fa-trash"></i>Delete</button>` : ''}
            </div>
        </div>`;

        // Load tags and populate asynchronously
        if (d.bill_id) _loadBillTags(d.bill_id);
        // Populate drop datalist for quick-edit
        if (d.bill_id) _populateQeDropList();

    } catch (err) {
        console.error('Load detail failed', err);
        body.innerHTML = `<p class="text-sm text-red-600 p-4">Failed to load document.</p>`;
    }
}

async function _loadBillTags(billId) {
    try {
        await _ensureMeta();
        const billTagsResp = await authFetch(`/api/tags/bill/${billId}`).then(r => r.json());
        const billTagIds = new Set((billTagsResp.tags || []).map(t => t.tag_id));
        const wrap = document.getElementById('bill-tags-wrap');
        if (!wrap) return;

        if (!_allTags || _allTags.length === 0) {
            wrap.innerHTML = '<span class="text-slate-400">No tags configured</span>';
            return;
        }

        // Group by tag_group
        const groups = {};
        _allTags.forEach(t => {
            if (!groups[t.tag_group]) groups[t.tag_group] = [];
            groups[t.tag_group].push(t);
        });

        wrap.innerHTML = Object.entries(groups).map(([grp, tags]) => `
            <div class="mb-2">
                <p class="text-xs text-slate-400 uppercase tracking-wide mb-1">${escapeHTML(grp)}</p>
                <div class="flex flex-wrap gap-2">
                    ${tags.map(t => `
                        <label class="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" value="${t.tag_id}" ${billTagIds.has(t.tag_id) ? 'checked' : ''}
                                class="rounded border-slate-300 text-indigo-600">
                            <span class="text-sm" style="color:${t.color || '#64748b'}">${escapeHTML(t.tag_name)}</span>
                        </label>`).join('')}
                </div>
            </div>`).join('');
    } catch (e) {
        console.error('_loadBillTags', e);
    }
}

// ── Quick-edit bill meta ─────────────────────────────────────────────────────
function toggleQuickEdit() {
    const panel = document.getElementById('quick-edit-panel');
    const chevron = document.getElementById('qe-chevron');
    if (!panel) return;
    const open = panel.classList.toggle('hidden');
    if (chevron) chevron.className = open ? 'fas fa-chevron-right text-[10px]' : 'fas fa-chevron-down text-[10px]';
}

async function _populateQeDropList() {
    await _ensureMeta();
    const dl = document.getElementById('qe-drop-list');
    if (!dl || !_metaDrops) return;
    dl.innerHTML = _metaDrops.map(d => `<option value="${escapeHTML(d.drop_name)}">`).join('');
}

async function submitQuickEdit(billId) {
    const drop    = (document.getElementById('qe-drop')?.value || '').trim();
    const dept    = (document.getElementById('qe-dept')?.value || '').trim();
    const cat     = (document.getElementById('qe-cat')?.value || '').trim();
    const channel = (document.getElementById('qe-channel')?.value || '').trim();
    const notes   = (document.getElementById('qe-notes')?.value || '').trim();
    const status  = document.getElementById('qe-status');

    const payload = {};
    if (drop)    payload.drop_name   = drop;
    if (dept)    payload.department  = dept;
    if (cat)     payload.category    = cat;
    if (channel) payload.channel     = channel;
    if (notes)   payload.notes       = notes;

    if (!Object.keys(payload).length) {
        if (status) { status.textContent = 'Nothing to save'; setTimeout(() => { status.textContent = ''; }, 2000); }
        return;
    }

    try {
        const r = await authFetch(`/api/bills/${billId}/meta`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const data = await r.json();
        if (r.ok && data.success) {
            if (status) { status.textContent = 'Saved ✓'; setTimeout(() => { status.textContent = ''; }, 2000); }
            // Refresh local document data
            const doc = allDocuments.find(d => d.bill_id === billId);
            if (doc) {
                if (drop)    { doc.drop_name = drop; doc.bill_drop_name = drop; }
                if (dept)    { doc.department = dept; doc.category_group = dept.toUpperCase(); }
                if (cat)     { doc.category = cat; doc.document_category = cat; }
                if (channel) { doc.channel = channel; }
                if (notes)   { doc.notes = notes; }
            }
        } else {
            if (status) { status.textContent = data.error || 'Error saving'; status.className = 'text-xs text-rose-600'; }
        }
    } catch (e) {
        console.error('submitQuickEdit', e);
        if (status) { status.textContent = 'Network error'; status.className = 'text-xs text-rose-600'; }
    }
}

// Item posting modal state
let _editingItemId = null;

async function openItemPostModal(itemId) {
    _editingItemId = itemId;
    const item = currentBillItems.find(i => i.item_id === itemId);
    if (!item) return;

    await _ensureMeta();

    const coaOpts = _metaCoa.map(c => `<option value="${c.coa_account_id}" ${c.coa_account_id == item.coa_account_id ? 'selected' : ''}>${escapeHTML(c.account_code + ' – ' + c.account_name)}</option>`).join('');
    const deptOpts = _metaDepts.map(d => `<option value="${d.department_id}" ${d.department_id == item.department_id ? 'selected' : ''}>${escapeHTML(d.department_name)}</option>`).join('');
    const dropOpts = _metaDrops.map(d => `<option value="${d.drop_id}" ${d.drop_id == item.drop_id ? 'selected' : ''}>${escapeHTML(d.drop_name)}</option>`).join('');

    const COST_NATURES = ['direct','indirect','fixed','variable','mixed'];
    const COST_STAGES  = ['pre_production','production','post_production','fulfillment','marketing','overhead'];

    let modal = document.getElementById('item-post-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'item-post-modal';
        modal.className = 'fixed inset-0 bg-black/40 flex items-center justify-center z-50';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
            <div class="flex items-center justify-between">
                <h3 class="text-sm font-semibold text-slate-800">Edit Posting — Line Item</h3>
                <button onclick="document.getElementById('item-post-modal').remove()" class="text-slate-400 hover:text-slate-600"><i class="fas fa-times"></i></button>
            </div>
            <p class="text-xs text-slate-500 truncate">${escapeHTML(item.description || '—')} · ₹${Number(item.amount || 0).toLocaleString('en-IN')}</p>

            <div class="space-y-3 text-sm">
                <div>
                    <label class="block text-xs text-slate-500 mb-1">CoA Account</label>
                    <select id="ipm-coa" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                        <option value="">— Not assigned —</option>${coaOpts}
                    </select>
                </div>
                <div>
                    <label class="block text-xs text-slate-500 mb-1">Department</label>
                    <select id="ipm-dept" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                        <option value="">— Not assigned —</option>${deptOpts}
                    </select>
                </div>
                <div>
                    <label class="block text-xs text-slate-500 mb-1">Drop</label>
                    <select id="ipm-drop" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                        <option value="">— Not assigned —</option>${dropOpts}
                    </select>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-xs text-slate-500 mb-1">Cost nature</label>
                        <select id="ipm-nature" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                            <option value="">—</option>
                            ${COST_NATURES.map(n => `<option value="${n}" ${item.cost_nature===n?'selected':''}>${n}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs text-slate-500 mb-1">Cost stage</label>
                        <select id="ipm-stage" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                            <option value="">—</option>
                            ${COST_STAGES.map(s => `<option value="${s}" ${item.cost_stage===s?'selected':''}>${s.replace(/_/g,' ')}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="flex items-center gap-3 pt-1">
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" id="ipm-golive" ${item.go_live_eligible ? 'checked' : ''} class="rounded border-slate-300 text-indigo-600">
                        <span class="text-xs text-slate-600">Go-live eligible</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" id="ipm-posted" ${item.posting_status === 'posted' ? 'checked' : ''} class="rounded border-slate-300 text-emerald-600">
                        <span class="text-xs text-slate-600">Mark as posted</span>
                    </label>
                </div>
            </div>

            <div class="flex gap-2 pt-2">
                <button onclick="_submitItemPost()" class="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Save</button>
                <button onclick="document.getElementById('item-post-modal').remove()" class="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200">Cancel</button>
            </div>
        </div>`;
    modal.classList.remove('hidden');
}

async function _submitItemPost() {
    const coa_account_id  = document.getElementById('ipm-coa')?.value    || null;
    const department_id   = document.getElementById('ipm-dept')?.value   || null;
    const drop_id         = document.getElementById('ipm-drop')?.value   || null;
    const cost_nature     = document.getElementById('ipm-nature')?.value || null;
    const cost_stage      = document.getElementById('ipm-stage')?.value  || null;
    const go_live_eligible= document.getElementById('ipm-golive')?.checked ?? false;
    const isPosted        = document.getElementById('ipm-posted')?.checked ?? false;

    const payload = {
        coa_account_id:   coa_account_id  ? parseInt(coa_account_id, 10)  : null,
        department_id:    department_id   ? parseInt(department_id, 10)   : null,
        drop_id:          drop_id         ? parseInt(drop_id, 10)         : null,
        cost_nature:      cost_nature     || null,
        cost_stage:       cost_stage      || null,
        go_live_eligible,
        posting_status:   isPosted ? 'posted' : 'unposted'
    };

    const result = await saveLineItemField(_editingItemId, payload);
    if (result?.success) {
        // Update currentBillItems in memory
        const idx = currentBillItems.findIndex(i => i.item_id === _editingItemId);
        if (idx >= 0) currentBillItems[idx] = { ...currentBillItems[idx], ...result.item };
        document.getElementById('item-post-modal')?.remove();
    }
}

function closeBillModal() {
    const modal = document.getElementById('bill-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}
function toggleSection(bodyId, btnId) {
    const body = document.getElementById(bodyId);
    const btn = document.getElementById(btnId);
    if (!body || !btn) return;
    const isCollapsed = body.classList.contains('collapsed');
    if (isCollapsed) {
        body.classList.remove('collapsed');
        body.classList.add('expanded');
        btn.innerHTML = `<i class="fas fa-chevron-up mr-1"></i>Collapse`;
    } else {
        body.classList.remove('expanded');
        body.classList.add('collapsed');
        btn.innerHTML = `<i class="fas fa-chevron-down mr-1"></i>Expand`;
    }
}

function closeDetail() {
    const pane = document.getElementById('detail-pane');
    if (pane) {
        pane.classList.add('mobile-hidden');
        pane.innerHTML = `<p class="text-sm text-gray-500">Select a bill to view details.</p>`;
    }
    selectedDocId = null;
}

async function processWithAI(documentId) {
    const modal = document.getElementById('ai-modal');
    const content = document.getElementById('ai-content');
    
    content.innerHTML = `
        <div class="text-center py-12">
            <i class="fas fa-robot text-6xl text-indigo-600 mb-4 animate-pulse"></i>
            <h3 class="text-xl font-semibold text-gray-900 mb-2">Processing with AI...</h3>
            <p class="text-gray-600">Extracting vendor details, amounts, payment terms, and line items</p>
            <div class="mt-6">
                <div class="w-full bg-gray-200 rounded-full h-2">
                    <div class="bg-indigo-600 h-2 rounded-full animate-pulse" style="width: 60%"></div>
                </div>
            </div>
        </div>
    `;
    
    modal.classList.remove('hidden');
    
    try {
        const response = await authFetch(`${API_URL}/bills/${documentId}/process`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            displayExtractedData(data.extracted_data, data.bill_id);
        } else {
            content.innerHTML = `
                <div class="text-center py-12">
                    <i class="fas fa-exclamation-triangle text-6xl text-red-600 mb-4"></i>
                    <h3 class="text-xl font-semibold text-gray-900 mb-2">Processing Failed</h3>
                    <p class="text-gray-600">${data.error || 'Unknown error'}</p>
                    <button onclick="closeAIModal()" class="mt-4 px-6 py-2 bg-gray-600 text-white rounded-lg">
                        Close
                    </button>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('AI Processing error:', error);
        content.innerHTML = `
            <div class="text-center py-12">
                <i class="fas fa-exclamation-triangle text-6xl text-red-600 mb-4"></i>
                <h3 class="text-xl font-semibold text-gray-900 mb-2">Processing Failed</h3>
                <p class="text-gray-600">${error.message}</p>
                <button onclick="closeAIModal()" class="mt-4 px-6 py-2 bg-gray-600 text-white rounded-lg">
                    Close
                </button>
            </div>
        `;
    }
}

async function retryAI(documentId) {
    try {
        const response = await authFetch(`${API_URL}/bills/${documentId}/process`, { method: 'POST' });
        const data = await response.json();
        if (data.success) {
            alert('AI retry successful');
            displayExtractedData(data.extracted_data, data.bill_id);
        } else {
            alert(`AI retry failed: ${data.error || 'Unknown error'}`);
        }
        loadDocuments();
    } catch (error) {
        alert(`AI retry failed: ${error.message}`);
        console.error('Retry AI error:', error);
    }
}

function displayExtractedData(data, billId) {
    const content = document.getElementById('ai-content');
    const actions = document.getElementById('ai-actions');
    const provider = data._provider ? data._provider.toUpperCase() : (data.manual ? 'MANUAL' : 'AI');
    const fallback = data._fallback ? ' (fallback)' : '';
    
    content.innerHTML = `
        <div class="space-y-6">
            <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                <div class="flex items-center">
                    <i class="fas fa-check-circle text-green-600 text-2xl mr-3"></i>
                    <div>
                        <h4 class="font-semibold text-green-900">Successfully Extracted</h4>
                        <p class="text-sm text-green-700">Confidence: ${Math.round((data.confidence || 0.9) * 100)}% • Provider: ${provider}${fallback}</p>
                    </div>
                </div>
            </div>
            
            <!-- Vendor Information -->
            <div class="bg-white border rounded-lg p-4">
                <h4 class="font-semibold text-gray-900 mb-3 flex items-center">
                    <i class="fas fa-building mr-2 text-indigo-600"></i>Vendor Information
                </h4>
                <div class="grid grid-cols-2 gap-4 text-sm">
                    <div><span class="text-gray-600">Name:</span> <span class="font-medium">${data.vendor_name || 'N/A'}</span></div>
                    <div><span class="text-gray-600">GSTIN:</span> <span class="font-medium">${data.vendor_gstin || 'N/A'}</span></div>
                    <div><span class="text-gray-600">Contact:</span> <span class="font-medium">${data.vendor_contact || 'N/A'}</span></div>
                    <div><span class="text-gray-600">Category:</span> <span class="font-medium">${data.category || 'N/A'}</span></div>
                </div>
            </div>
            
            <!-- Bill Details -->
            <div class="bg-white border rounded-lg p-4">
                <h4 class="font-semibold text-gray-900 mb-3 flex items-center">
                    <i class="fas fa-file-invoice mr-2 text-indigo-600"></i>Bill Details
                </h4>
                <div class="grid grid-cols-2 gap-4 text-sm">
                    <div><span class="text-gray-600">Bill Number:</span> <span class="font-medium">${data.bill_number || 'N/A'}</span></div>
                    <div><span class="text-gray-600">Bill Date:</span> <span class="font-medium">${data.bill_date || 'N/A'}</span></div>
                </div>
            </div>
            
            <!-- Amounts -->
            <div class="bg-white border rounded-lg p-4">
                <h4 class="font-semibold text-gray-900 mb-3 flex items-center">
                    <i class="fas fa-rupee-sign mr-2 text-indigo-600"></i>Amounts
                </h4>
                <div class="space-y-2 text-sm">
                    <div class="flex justify-between"><span class="text-gray-600">Subtotal:</span> <span class="font-medium">₹${(data.amounts?.subtotal || 0).toLocaleString()}</span></div>
                    <div class="flex justify-between"><span class="text-gray-600">Tax:</span> <span class="font-medium">₹${(data.amounts?.tax_amount || 0).toLocaleString()}</span></div>
                    <div class="flex justify-between border-t pt-2"><span class="font-semibold">Total:</span> <span class="font-bold text-lg">₹${(data.amounts?.total || 0).toLocaleString()}</span></div>
                </div>
            </div>
            
            <!-- Payment Terms -->
            ${data.payment_terms ? `
            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 class="font-semibold text-gray-900 mb-3 flex items-center">
                    <i class="fas fa-calendar-alt mr-2 text-yellow-600"></i>Payment Terms
                </h4>
                <div class="space-y-2 text-sm">
                    <div><span class="text-gray-600">Type:</span> <span class="font-medium">${data.payment_terms.type}</span></div>
                    ${data.payment_terms.description ? `<div><span class="text-gray-600">Terms:</span> <span class="font-medium">${data.payment_terms.description}</span></div>` : ''}
                    ${data.payment_terms.due_date ? `<div><span class="text-gray-600">Due Date:</span> <span class="font-medium text-red-600">${data.payment_terms.due_date}</span></div>` : ''}
                    ${data.payment_terms.advance_percentage ? `<div><span class="text-gray-600">Advance:</span> <span class="font-medium">${data.payment_terms.advance_percentage}%</span></div>` : ''}
                </div>
            </div>
            ` : ''}
            
            <!-- Line Items -->
            ${data.line_items && data.line_items.length > 0 ? `
            <div class="bg-white border rounded-lg p-4">
                <h4 class="font-semibold text-gray-900 mb-3 flex items-center">
                    <i class="fas fa-list mr-2 text-indigo-600"></i>Line Items
                </h4>
                <div class="overflow-x-auto">
                    <table class="min-w-full text-sm">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-4 py-2 text-left">Description</th>
                                <th class="px-4 py-2 text-right">Qty</th>
                                <th class="px-4 py-2 text-right">Rate</th>
                                <th class="px-4 py-2 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y">
                            ${data.line_items.map(item => `
                                <tr>
                                    <td class="px-4 py-2">${item.description}</td>
                                    <td class="px-4 py-2 text-right">${item.quantity || '-'}</td>
                                    <td class="px-4 py-2 text-right">₹${(item.rate || 0).toLocaleString()}</td>
                                    <td class="px-4 py-2 text-right font-medium">₹${(item.amount || 0).toLocaleString()}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            ` : ''}
        </div>
    `;
    
    actions.innerHTML = `
        <div class="flex justify-end items-center">
            <button onclick="closeAIModal(); loadDocuments();" class="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                <i class="fas fa-check mr-2"></i>Done - Bill Recorded
            </button>
        </div>
    `;
}

async function viewExtractedData(documentId) {
    try {
        const response = await authFetch(`${API_URL}/documents/${documentId}`);
        const data = await response.json();
        
        if (data.success && data.document.gemini_data) {
            const modal = document.getElementById('ai-modal');
            modal.classList.remove('hidden');
            displayExtractedData(data.document.gemini_data, null);
        }
    } catch (error) {
        console.error('Error viewing data:', error);
    }
}

function closeAIModal() {
    document.getElementById('ai-modal').classList.add('hidden');
}

function escapeQuotes(str) {
    return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
}

function canPreviewFile(mimeType) {
    if (!mimeType) return false;
    return mimeType.includes('pdf') || mimeType.includes('image');
}

function viewDocument(id, fileName, fileType) {
    const modal = document.getElementById('preview-modal');
    const modalTitle = document.getElementById('modal-title');
    const previewContent = document.getElementById('preview-content');
    
    modalTitle.textContent = fileName;
    
    if (fileType.includes('pdf')) {
        previewContent.innerHTML = `<iframe src="${API_URL}/files/${id}" class="w-full h-full min-h-[600px] border-0"></iframe>`;
    } else if (fileType.includes('image')) {
        previewContent.innerHTML = `<div class="flex items-center justify-center"><img src="${API_URL}/files/${id}" alt="${fileName}" class="max-w-full max-h-[70vh] object-contain"></div>`;
    }
    
    modal.classList.remove('hidden');
}

function closePreview() {
    document.getElementById('preview-modal').classList.add('hidden');
}

function downloadDocument(id) {
    window.open(`${API_URL}/files/${id}/download`, '_blank');
}

function getStatusBadge(status) {
    if (status === 'processed') return '<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700"><i class="fas fa-check-circle mr-1"></i>Processed</span>';
    if (status === 'manual_required') return '<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700"><i class="fas fa-hand-paper mr-1"></i>Manual Required</span>';
    if (status === 'error') return '<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700"><i class="fas fa-times-circle mr-1"></i>Error</span>';
    if (status === 'processing') return '<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700"><i class="fas fa-spinner fa-spin mr-1"></i>Processing</span>';
    return '<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700"><i class="fas fa-clock mr-1"></i>Uploaded</span>';
}

function getProviderInfo(aiData) {
    if (!aiData) return null;
    try {
        const provider = aiData._provider || (aiData._fallback ? 'fallback' : null);
        if (aiData._note) return `AI: ${provider || 'heuristic'} (${aiData._note})`;
        if (provider === 'openai') return 'AI: OpenAI';
        if (provider === 'rule' || provider === 'heuristic') return 'AI: Heuristic';
        if (aiData.manual) return 'Manual';
        return provider ? `AI: ${provider}` : null;
    } catch (_) {
        return null;
    }
}

document.addEventListener('click', (e) => {
    const modal = document.getElementById('preview-modal');
    if (e.target === modal) closePreview();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closePreview();
        closeAIModal();
        closeBillModal();
    }
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if (e.key.toLowerCase() === 'u') location.href = 'upload.html';
    if (e.key.toLowerCase() === 'r') location.href = 'reports.html';
    if (e.key.toLowerCase() === 'p') location.href = 'payables.html';
    if (e.key === '/') {
        e.preventDefault();
        const sb = document.getElementById('search-box');
        if (sb) { sb.focus(); sb.select(); }
    }
});

function populateCategoryDropdown(selectedGroup) {
    const catSel = document.getElementById('filter-category');
    if (!catSel) return;
    const currentVal = catSel.value;

    // Deduplicate by value within a group
    const dedup = (cats) => {
        const seen = new Set();
        return cats.filter(c => { if (seen.has(c.value)) return false; seen.add(c.value); return true; });
    };

    if (selectedGroup && CATEGORY_GROUPS[selectedGroup]) {
        // Show only categories for selected group
        const cats = dedup(CATEGORY_GROUPS[selectedGroup]);
        catSel.innerHTML = '<option value="">All categories</option>' +
            cats.map(c => `<option value="${c.value}">${c.label}</option>`).join('');
    } else {
        // Show all groups with optgroups
        let html = '<option value="">All categories</option>';
        Object.keys(CATEGORY_GROUPS).forEach(grp => {
            const cats = dedup(CATEGORY_GROUPS[grp]);
            html += `<optgroup label="${GROUP_LABELS[grp]}">`;
            html += cats.map(c => `<option value="${c.value}">${c.label}</option>`).join('');
            html += '</optgroup>';
        });
        catSel.innerHTML = html;
    }

    // Restore previous selection if still valid
    if (currentVal) catSel.value = currentVal;
}

function populateFilterDropdowns(docs) {
    // Category dropdown — static canonical map, cascades from group filter
    const groupSel = document.getElementById('filter-group');
    populateCategoryDropdown(groupSel ? groupSel.value : '');

    // Drop — built from actual document data
    const dropSel = document.getElementById('filter-drop');
    const bulkDropSel = document.getElementById('bulk-drop');
    if (dropSel || bulkDropSel) {
        const drops = new Set();
        docs.forEach(doc => {
            const d = doc.bill_drop_name || doc.drop_name;
            if (d && d !== 'Unassigned') drops.add(d);
        });
        const sortedDrops = [...drops].sort();
        if (dropSel) {
            let dropHTML = '<option value="">All drops</option>';
            sortedDrops.forEach(d => { dropHTML += `<option value="${d}">${d}</option>`; });
            if (drops.size) dropHTML += '<option value="Unassigned">Unassigned</option>';
            dropSel.innerHTML = dropHTML;
        }
        if (bulkDropSel) {
            let html = '<option value="">Set drop…</option>';
            sortedDrops.forEach(d => { html += `<option value="${d}">${d}</option>`; });
            bulkDropSel.innerHTML = html;
        }
    }
}

function filterDocuments() {
    const dateFrom    = document.getElementById('date-from').value;
    const dateTo      = document.getElementById('date-to').value;
    const category    = document.getElementById('filter-category').value;
    const groupFilter = document.getElementById('filter-group')?.value || '';
    const sectionFilter = document.getElementById('filter-section')?.value || '';
    const dropFilter  = document.getElementById('filter-drop')?.value || '';
    const searchTerm  = document.getElementById('search-box').value.toLowerCase();
    const paymentFilter    = document.getElementById('filter-payment').value;
    const payStatusFilter  = document.getElementById('filter-pay-status')?.value || '';
    const statusFilter     = document.getElementById('filter-status').value;
    const flagFilter       = document.getElementById('filter-flag')?.value || '';

    let filtered = allDocuments;

    if (dateFrom) {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        filtered = filtered.filter(doc => {
            const docDate = new Date(getDocDate(doc));
            docDate.setHours(0, 0, 0, 0);
            return docDate >= fromDate;
        });
    }

    if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        filtered = filtered.filter(doc => new Date(getDocDate(doc)) <= toDate);
    }

    if (groupFilter) {
        filtered = filtered.filter(doc => {
            const grp = (getCategoryGroup(doc) || '').toUpperCase();
            const norm = grp === 'OPERATING' ? 'OPERATIONS' : grp;
            if (groupFilter === 'none') return !norm;
            return norm === groupFilter;
        });
    }

    if (category) {
        filtered = filtered.filter(doc => (getCategory(doc) || '').toLowerCase() === category.toLowerCase());
    }

    if (sectionFilter) {
        filtered = filtered.filter(doc => (doc.bill_section || doc.section || '') === sectionFilter);
    }

    if (dropFilter) {
        filtered = filtered.filter(doc => (doc.bill_drop_name || doc.drop_name || '') === dropFilter);
    }

    if (statusFilter) {
        filtered = filtered.filter(doc => (doc.status || '') === statusFilter);
    }

    if (paymentFilter) {
        filtered = filtered.filter(doc => (getPayment(doc) || '').toUpperCase() === paymentFilter.toUpperCase());
    }

    if (payStatusFilter) {
        filtered = filtered.filter(doc => (doc.bill_payment_status || doc.payment_status || '') === payStatusFilter);
    }

    if (searchTerm) {
        filtered = filtered.filter(doc => {
            const vendor   = (doc.bill_vendor_name || doc.vendor_name || doc.gemini_data?.vendor_name || '').toLowerCase();
            const fname    = (doc.file_name || '').toLowerCase();
            const notes    = (doc.notes || '').toLowerCase();
            const category = (getCategory(doc) || '').toLowerCase();
            const billNum  = (doc.bill_number || '').toLowerCase();
            return vendor.includes(searchTerm) || fname.includes(searchTerm) || notes.includes(searchTerm) || category.includes(searchTerm) || billNum.includes(searchTerm);
        });
    }

    filtered = filtered.filter(doc => docMatchesVerificationFilter(doc));

    if (flagFilter === 'no-date') {
        filtered = filtered.filter(doc => !docHasBillDate(doc));
    } else if (flagFilter === 'no-group') {
        filtered = filtered.filter(doc => !getCategoryGroup(doc));
    } else if (flagFilter === 'no-drop') {
        filtered = filtered.filter(doc => !(doc.bill_drop_name || doc.drop_name));
    } else if (flagFilter === 'overdue') {
        const now = new Date();
        filtered = filtered.filter(doc => {
            const due = doc.bill_payment_due_date;
            const payStatus = doc.bill_payment_status || doc.payment_status || '';
            return due && new Date(due) < now && payStatus !== 'paid';
        });
    } else if (flagFilter === 'high-value') {
        filtered = filtered.filter(doc => Number(doc.total_amount || doc.bill_total_amount || 0) >= 10000);
    } else if (flagFilter === 'missing-dims') {
        // Bills with posted line items that have missing COA, dept, or drop
        filtered = filtered.filter(doc => {
            const items = doc.line_items || [];
            return items.some(i => i.posting_status === 'posted' && (!i.coa_account_id || !i.department_id || !i.drop_id));
        });
    } else if (flagFilter === 'unposted-postable') {
        // Bills with line items that are postable but not yet posted
        filtered = filtered.filter(doc => {
            const items = doc.line_items || [];
            return items.some(i => i.is_postable && i.posting_status !== 'posted');
        });
    }

    filteredDocuments = filtered;
    displayDocuments(filteredDocuments);
    updateDocCount();
    updateFilterSummary();
}

function setDateFilter(period) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let fromDate, toDate;
    
    switch(period) {
        case 'today':
            fromDate = toDate = new Date(today);
            break;
        case 'yesterday':
            fromDate = toDate = new Date(today.setDate(today.getDate() - 1));
            break;
        case 'thisWeek':
            fromDate = new Date(today.setDate(today.getDate() - today.getDay()));
            toDate = new Date();
            break;
        case 'thisMonth':
            fromDate = new Date(today.getFullYear(), today.getMonth(), 1);
            toDate = new Date();
            break;
    }
    
    document.getElementById('date-from').value = formatDateInput(fromDate);
    document.getElementById('date-to').value = formatDateInput(toDate);
    filterDocuments();
}

function clearFilters() {
    ['date-from','date-to','filter-category','filter-group','filter-section',
     'filter-drop','filter-payment','filter-pay-status','filter-status','search-box','filter-flag']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    populateCategoryDropdown('');
    verificationFilter = 'all';
    renderVerificationFilters();
    filterDocuments();
}

function sortDocuments() {
    const sortBy = document.getElementById('sort-by').value;
    let sorted = [...filteredDocuments];
    
    const getAmount = d => Number(d.total_amount || d.bill_total_amount || d.gemini_data?.amounts?.total || 0);
    const getVendor = d => (d.bill_vendor_name || d.vendor_name || d.gemini_data?.vendor_name || d.file_name || '').toLowerCase();
    switch(sortBy) {
        case 'date-desc':    sorted.sort((a, b) => new Date(getDocDate(b)) - new Date(getDocDate(a))); break;
        case 'date-asc':     sorted.sort((a, b) => new Date(getDocDate(a)) - new Date(getDocDate(b))); break;
        case 'amount-desc':  sorted.sort((a, b) => getAmount(b) - getAmount(a)); break;
        case 'amount-asc':   sorted.sort((a, b) => getAmount(a) - getAmount(b)); break;
        case 'name-asc':     sorted.sort((a, b) => getVendor(a).localeCompare(getVendor(b))); break;
        case 'name-desc':    sorted.sort((a, b) => getVendor(b).localeCompare(getVendor(a))); break;
    }
    
    displayDocuments(sorted);
}

function updateDocCount() {
    const total = allDocuments.length;
    const showing = filteredDocuments.length;
    const totalSpend = filteredDocuments.reduce((s, d) => s + Number(d.bill_total_amount || d.total_amount || 0), 0);
    const docCountEl = document.getElementById('doc-count');
    if (docCountEl) {
        const spendStr = totalSpend > 0 ? ` · ₹${totalSpend.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '';
        docCountEl.textContent = showing < total ? `(${showing} of ${total}${spendStr})` : `(${total}${spendStr})`;
    }
    const heroEl = document.getElementById('doc-count-hero');
    if (heroEl) {
        heroEl.textContent = `${showing}/${total || 0}`;
    }
    const needsReviewCount = verificationSummary?.needs_review
        ?? allDocuments.filter(doc => getVerificationStatus(doc) === 'needs_review').length;
    const processedCount = allDocuments.filter(doc => doc.status === 'processed').length;
    const needsReviewEl = document.getElementById('needs-review-count');
    if (needsReviewEl) needsReviewEl.textContent = needsReviewCount;
    const processedEl = document.getElementById('processed-count');
    if (processedEl) processedEl.textContent = processedCount;
}

function updateFilterSummary() {
    const dateFrom      = document.getElementById('date-from').value;
    const dateTo        = document.getElementById('date-to').value;
    const category      = document.getElementById('filter-category').value;
    const groupFilter   = document.getElementById('filter-group')?.value;
    const sectionFilter = document.getElementById('filter-section')?.value;
    const dropFilter    = document.getElementById('filter-drop')?.value;
    const searchTerm    = document.getElementById('search-box').value;
    const paymentFilter     = document.getElementById('filter-payment').value;
    const payStatusFilter   = document.getElementById('filter-pay-status')?.value;
    const statusFilter      = document.getElementById('filter-status').value;

    const activeFilters = [];
    if (dateFrom && dateTo) activeFilters.push(`${formatDateDisplay(dateFrom)} → ${formatDateDisplay(dateTo)}`);
    else if (dateFrom) activeFilters.push(`From ${formatDateDisplay(dateFrom)}`);
    else if (dateTo) activeFilters.push(`Until ${formatDateDisplay(dateTo)}`);
    if (groupFilter) activeFilters.push(`Group: ${groupFilter}`);
    if (category) activeFilters.push(`Category: ${category}`);
    if (sectionFilter) activeFilters.push(`Section: ${sectionFilter}`);
    if (dropFilter) activeFilters.push(`Drop: ${dropFilter}`);
    if (paymentFilter) activeFilters.push(`Method: ${paymentFilter}`);
    if (payStatusFilter) activeFilters.push(`Pay status: ${payStatusFilter}`);
    if (statusFilter) activeFilters.push(`Doc status: ${statusFilter}`);
    if (searchTerm) activeFilters.push(`"${searchTerm}"`);
    if (verificationFilter !== 'all') activeFilters.push(`Verification: ${getVerificationFilterLabel(verificationFilter)}`);
    
    const filterContainer = document.getElementById('active-filters');
    const filterSummary = document.getElementById('filter-summary');
    
    if (activeFilters.length > 0) {
        filterSummary.textContent = `Active filters: ${activeFilters.join(' • ')}`;
        filterContainer.classList.remove('hidden');
    } else {
        filterContainer.classList.add('hidden');
    }

    renderTable(filteredDocuments);
    renderDetail(filteredDocuments[0]);
}

async function deleteDocument(id) {
    if (!confirm('Are you sure you want to delete this document?')) return;
    
    try {
        const response = await authFetch(`${API_URL}/documents/${id}`, { method: 'DELETE' });
        const data = await response.json();
        
        if (data.success) {
            await loadDocuments(); // refresh table + calendar fully
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

async function deleteBill(billId) {
    if (!confirm('Delete this bill and reset the document for reprocess?')) return;
    try {
        const resp = await authFetch(`${API_URL}/bills/${billId}`, { method: 'DELETE' });
        const data = await resp.json();
        if (data.success) {
            alert('Bill deleted. Document reset to uploaded.');
            loadDocuments();
        } else {
            alert(data.error || 'Failed to delete bill');
        }
    } catch (err) {
        console.error('Delete bill error:', err);
        alert('Failed to delete bill');
    }
}

// Keyboard navigation for table (up/down + Enter)
document.addEventListener('keydown', (e) => {
    const rows = Array.from(document.querySelectorAll('#documents-table-body tr'));
    if (!rows.length) return;
    let idx = rows.findIndex(r => r.classList.contains('ring-2'));
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        idx = Math.min(idx + 1, rows.length - 1);
        highlightRow(rows, idx);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        idx = Math.max(idx - 1, 0);
        highlightRow(rows, idx);
    } else if (e.key === 'Enter' && idx >= 0) {
        const id = rows[idx].dataset.id;
        if (id) selectDocument(Number(id));
    }
});

function highlightRow(rows, idx) {
    rows.forEach(r => r.classList.remove('ring-2', 'ring-indigo-300'));
    const row = rows[idx];
    if (row) {
        row.classList.add('ring-2', 'ring-indigo-300');
        const id = row.dataset.id;
        if (id) selectDocument(Number(id));
        row.scrollIntoView({ block: 'nearest' });
    }
}

function getFileIconInfo(mimeType, fileName) {
    if (!mimeType) mimeType = '';
    if (!fileName) fileName = '';
    
    if (mimeType.includes('pdf')) return { icon: 'fa-file-pdf', color: 'text-red-500', label: 'PDF' };
    if (mimeType.includes('image')) return { icon: 'fa-file-image', color: 'text-blue-500', label: 'Image' };
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        return { icon: 'fa-file-excel', color: 'text-green-600', label: 'Excel' };
    }
    if (mimeType.includes('wordprocessing') || mimeType.includes('msword') || fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
        return { icon: 'fa-file-word', color: 'text-blue-600', label: 'Word' };
    }
    return { icon: 'fa-file-alt', color: 'text-gray-500', label: 'Document' };
}

function formatDateInput(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDateDisplay(dateString) {
    if (!dateString) return '—';
    const dt = new Date(dateString);
    if (Number.isNaN(dt.getTime())) return '—';
    return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Calendar view helpers
function changeCalendarMonth(delta) {
    calendarCursor.setMonth(calendarCursor.getMonth() + delta);
    renderCalendar();
}

function renderCalendar() {
    const monthName = calendarCursor.toLocaleString('default', { month: 'long', year: 'numeric' });
    document.getElementById('calendar-month').textContent = monthName;
    const billBtn = document.getElementById('mode-billdate');
    const uploadBtn = document.getElementById('mode-uploaddate');
    if (billBtn && uploadBtn) {
        if (useBillDateMode) {
            billBtn.className = 'px-2 py-1 bg-indigo-600 text-white';
            uploadBtn.className = 'px-2 py-1 bg-white text-slate-700';
        } else {
            billBtn.className = 'px-2 py-1 bg-white text-slate-700';
            uploadBtn.className = 'px-2 py-1 bg-indigo-600 text-white';
        }
    }
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';

    const year = calendarCursor.getFullYear();
    const month = calendarCursor.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDay = firstDay.getDay(); // 0-6
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Map dates to document counts
    const docCountByDate = {};
    allDocuments.forEach(doc => {
        const d = new Date(getDocDate(doc));
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        docCountByDate[key] = (docCountByDate[key] || 0) + 1;
    });

    // Fill blanks before first day
    for (let i = 0; i < startDay; i++) {
        grid.innerHTML += `<div class="py-3"></div>`;
    }

    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
        const key = `${year}-${month}-${day}`;
        const count = docCountByDate[key] || 0;
        const dateStr = formatDateInput(new Date(year, month, day));
        const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

        grid.innerHTML += `
            <button 
                class="py-3 rounded-md border text-sm hover:border-indigo-400 hover:bg-indigo-50 transition ${count ? 'bg-indigo-50 border-indigo-200' : 'border-gray-200'} ${isToday ? 'ring-2 ring-green-300' : ''}"
                onclick="filterByDate('${dateStr}')">
                <div class="font-semibold text-gray-800">${day}</div>
                <div class="text-xs text-gray-500">${count ? `${count} bill${count>1?'s':''}` : ''}</div>
            </button>
        `;
    }
}

function filterByDate(dateStr) {
    document.getElementById('date-from').value = dateStr;
    document.getElementById('date-to').value = dateStr;
    filterDocuments();
}

function setDateMode(mode) {
    useBillDateMode = (mode === 'bill');
    renderCalendar();
    filterDocuments();
}

// Manual Processing Helpers
async function openManualModal(documentId) {
    let doc = allDocuments.find(d => d.document_id === documentId) || null;
    let billLineItems = null;

    try {
        const response = await authFetch(`${API_URL}/documents/${documentId}`);
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.document) {
                const detail = data.document;
                doc = doc ? { ...doc, ...detail } : detail;
                billLineItems = Array.isArray(detail.line_items) ? detail.line_items : null;
                if (detail.gemini_data && !doc.gemini_data) {
                    doc.gemini_data = detail.gemini_data;
                }
            }
        }
    } catch (err) {
        console.error('Failed to load document detail', err);
    }

    if (!doc) return;
    populateManualForm(doc, billLineItems);
}

function populateManualForm(doc, billLineItems) {
    currentManualDoc = doc;
    const gemData = doc.gemini_data || {};
    const amounts = gemData.amounts || {};

    if (Array.isArray(billLineItems) && billLineItems.length) {
        manualLineItems = billLineItems.map(item => ({
            description: item.description || '',
            sku_code: item.sku_code || '',
            quantity: Number(item.quantity || 0),
            rate: item.unit_price != null ? Number(item.unit_price) : Number(item.rate || 0),
            amount: Number(item.amount || 0)
        }));
    } else if (gemData.line_items && Array.isArray(gemData.line_items)) {
        manualLineItems = gemData.line_items.map((item) => ({
            description: item.description || '',
            sku_code: item.sku_code || '',
            quantity: Number(item.quantity || 0),
            rate: Number(item.rate || 0),
            amount: Number(item.amount || 0)
        }));
    } else {
        manualLineItems = [{
            description: doc.file_name || gemData.bill_number || 'Line item',
            sku_code: '',
            quantity: 1,
            rate: parseFloat(doc.bill_total_amount ?? doc.total_amount ?? amounts.total ?? 0) || 0,
            amount: parseFloat(doc.bill_total_amount ?? doc.total_amount ?? amounts.total ?? 0) || 0
        }];
    }

    const vendorName = doc.bill_vendor_name || doc.vendor_name || gemData.vendor_name || '';
    document.getElementById('manual-vendor-name').value = vendorName;

    document.getElementById('manual-bill-number').value = doc.bill_number || gemData.bill_number || '';
    const rawBillDate = doc.bill_date || gemData.bill_date || '';
    document.getElementById('manual-bill-date').value = rawBillDate ? rawBillDate.split('T')[0] : '';

    const manualCat = doc.bill_category || doc.document_category || doc.category || getCategory(doc);
    setSelectValue('manual-category', (manualCat && manualCat !== '—') ? manualCat : 'misc', 'misc');

    const subtotalGuess = (doc.bill_subtotal ?? doc.subtotal ?? amounts.subtotal) || '';
    document.getElementById('manual-subtotal').value = subtotalGuess;

    const taxGuess = (doc.bill_tax_amount ?? doc.tax_amount ?? amounts.tax_amount ??
        ((amounts.cgst || 0) + (amounts.sgst || 0) + (amounts.igst || 0))) || '';
    document.getElementById('manual-tax').value = taxGuess;

    const totalGuess = (doc.bill_total_amount ?? doc.total_amount ?? amounts.total) || '';
    document.getElementById('manual-total').value = totalGuess;

    const payMethod = doc.bill_payment_method || doc.document_payment_method || doc.payment_method || getPayment(doc);
    setSelectValue('manual-payment-method', (payMethod && payMethod !== '—') ? payMethod : '', '');

    const mergedTerms = doc.payment_terms
        || gemData.payment_terms
        || ((doc.bill_payment_type || doc.bill_advance_percentage || doc.bill_payment_due_date) ? {
            type: doc.bill_payment_type,
            advance_percentage: doc.bill_advance_percentage,
            due_date: doc.bill_payment_due_date
        } : null)
        || {};
    doc.payment_terms = mergedTerms;

    setSelectValue('manual-pay-type', mergedTerms.type || 'FULL', 'FULL');
    document.getElementById('manual-advance').value = mergedTerms.advance_percentage ?? '';
    const due = mergedTerms.due_date ? mergedTerms.due_date.split('T')[0] : '';
    document.getElementById('manual-due-date').value = due;
    document.getElementById('manual-notes').value = doc.notes || '';
    setSelectValue('manual-department', doc.bill_category_group || doc.category_group || doc.department || '', '');
    setSelectValue('manual-section', doc.bill_section || doc.section || '', '');
    loadManualDropList(doc.bill_drop_name || doc.drop_name || '');
    document.getElementById('manual-error').textContent = '';
    syncManualPaymentFields();
    updateManualAdvanceSummary();
    renderLineItems();
    document.getElementById('manual-modal').classList.remove('hidden');
}

async function loadManualDropList(currentDrop) {
    const sel = document.getElementById('manual-drop');
    if (!sel) return;
    try {
        const r = await authFetch('/api/meta/drops');
        const data = await r.json();
        const drops = data.drops || [];
        sel.innerHTML = '<option value="">- select drop -</option><option value="Unassigned">Unassigned</option>';
        drops.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.drop_name;
            opt.textContent = d.drop_name;
            sel.appendChild(opt);
        });
        if (currentDrop) sel.value = currentDrop;
    } catch (e) { /* keep defaults */ }
}

function syncManualPaymentFields() {
    const payTypeEl = document.getElementById('manual-pay-type');
    const advanceInput = document.getElementById('manual-advance');
    const dueInput = document.getElementById('manual-due-date');
    if (!payTypeEl || !advanceInput) return;
    const wrapper = advanceInput.parentElement;
    if (payTypeEl.value === 'ADVANCE') {
        advanceInput.disabled = false;
        if (wrapper) wrapper.classList.remove('opacity-50');
        if (dueInput) dueInput.required = true;
    } else {
        advanceInput.disabled = true;
        advanceInput.value = '';
        if (wrapper) wrapper.classList.add('opacity-50');
        if (dueInput) {
            dueInput.required = false;
            dueInput.value = '';
        }
    }
    updateManualAdvanceSummary();
}

function updateManualAdvanceSummary() {
    const note = document.getElementById('manual-balance-note');
    if (!note) return;
    const payType = document.getElementById('manual-pay-type')?.value || 'FULL';
    const total = parseFloat(document.getElementById('manual-total')?.value || 0);
    const advancePct = parseFloat(document.getElementById('manual-advance')?.value || 0);
    const dueDateRaw = document.getElementById('manual-due-date')?.value || '';

    if (payType !== 'ADVANCE' || !total) {
        note.textContent = '';
        return;
    }
    const advanceAmount = advancePct ? (total * advancePct) / 100 : 0;
    const balance = Math.max(total - advanceAmount, 0);
    const dateLabel = dueDateRaw ? `due on ${formatDateDisplay(dueDateRaw)}` : 'set a due date';
    note.textContent = `Balance ₹${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${dateLabel}`;
}

function closeManualModal() {
    document.getElementById('manual-modal').classList.add('hidden');
    currentManualDoc = null;
    manualLineItems = [];
}

function renderLineItems() {
    const tbody = document.getElementById('manual-line-items');
    tbody.innerHTML = manualLineItems.map((item, idx) => `
        <tr>
            <td class="px-3 py-2">
                <input value="${item.description || ''}" class="w-full px-2 py-1 border rounded" onchange="updateLineItem(${idx}, 'description', this.value)">
            </td>
            <td class="px-3 py-2">
                <input value="${item.sku_code || ''}" class="w-full px-2 py-1 border rounded" placeholder="SKU" onchange="updateLineItem(${idx}, 'sku_code', this.value)">
            </td>
            <td class="px-3 py-2 text-right">
                <input type="number" step="0.01" min="0" value="${item.quantity || 0}" class="w-24 px-2 py-1 border rounded text-right" onchange="updateLineItem(${idx}, 'quantity', this.value)">
            </td>
            <td class="px-3 py-2 text-right">
                <input type="number" step="0.01" min="0" value="${item.rate || 0}" class="w-28 px-2 py-1 border rounded text-right" onchange="updateLineItem(${idx}, 'rate', this.value)">
            </td>
            <td class="px-3 py-2 text-right">
                <input type="number" step="0.01" min="0" value="${item.amount || 0}" class="w-28 px-2 py-1 border rounded text-right" onchange="updateLineItem(${idx}, 'amount', this.value)">
            </td>
            <td class="px-3 py-2 text-right">
                <button type="button" onclick="removeLineItemRow(${idx})" class="px-2 py-1 text-red-600 hover:text-red-800">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function addLineItemRow() {
    manualLineItems.push({ description: '', sku_code: '', quantity: 1, rate: 0, amount: 0 });
    renderLineItems();
}

function removeLineItemRow(idx) {
    manualLineItems.splice(idx, 1);
    if (manualLineItems.length === 0) manualLineItems.push({ description: '', sku_code: '', quantity: 1, rate: 0, amount: 0 });
    renderLineItems();
}

function updateLineItem(idx, field, value) {
    if (!manualLineItems[idx]) return;
    if (['quantity', 'rate', 'amount'].includes(field)) {
        manualLineItems[idx][field] = parseFloat(value || 0);
    } else {
        manualLineItems[idx][field] = value;
    }
}

async function submitManual(event) {
    event.preventDefault();
    if (!currentManualDoc) return;
    const errorEl = document.getElementById('manual-error');
    errorEl.textContent = '';

    const payload = {
        vendor_name: document.getElementById('manual-vendor-name').value.trim(),
        bill_number: document.getElementById('manual-bill-number').value.trim(),
        bill_date: document.getElementById('manual-bill-date').value || null,
        category: document.getElementById('manual-category').value || 'misc',
        department: document.getElementById('manual-department').value || null,
        drop_name: document.getElementById('manual-drop').value || null,
        section: document.getElementById('manual-section').value || null,
        subtotal: parseFloat(document.getElementById('manual-subtotal').value || 0),
        tax_amount: parseFloat(document.getElementById('manual-tax').value || 0),
        total_amount: parseFloat(document.getElementById('manual-total').value || 0),
        payment_method: document.getElementById('manual-payment-method').value || '',
        payment_terms: {
          type: document.getElementById('manual-pay-type').value,
          description: '',
          advance_percentage: document.getElementById('manual-advance').value ? parseFloat(document.getElementById('manual-advance').value) : null,
          due_date: document.getElementById('manual-due-date').value || null,
          installments: []
        },
        line_items: manualLineItems,
        notes: document.getElementById('manual-notes').value
    };

    if (!payload.vendor_name) {
        errorEl.textContent = 'Vendor name is required.';
        return;
    }
    if (!payload.total_amount || payload.total_amount <= 0) {
        errorEl.textContent = 'Total amount must be greater than zero.';
        return;
    }
    if (!payload.category) {
        errorEl.textContent = 'Category is required.';
        return;
    }
    if (!payload.payment_method) {
        errorEl.textContent = 'Payment method is required.';
        return;
    }
    if (payload.payment_terms.type === 'ADVANCE') {
        if (!payload.payment_terms.advance_percentage || payload.payment_terms.advance_percentage <= 0) {
            errorEl.textContent = 'Advance percentage is required for advance payment terms.';
            return;
        }
        if (!payload.payment_terms.due_date) {
            errorEl.textContent = 'Advance payment terms need a due date for the balance.';
            return;
        }
    } else {
        payload.payment_terms.advance_percentage = null;
        if (!payload.payment_terms.due_date) {
            payload.payment_terms.due_date = null;
        }
    }

    try {
        const response = await authFetch(`${API_URL}/bills/${currentManualDoc.document_id}/manual`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (data.success) {
            alert('Bill processed manually and posted.');
            closeManualModal();
            loadDocuments();
        } else {
            errorEl.textContent = data.error || 'Manual processing failed';
        }
    } catch (err) {
        errorEl.textContent = err.message;
        console.error('Manual submit error:', err);
    }
}

// Lightweight action wrappers used by inline buttons in the document modal.
// Keeping these here ensures the buttons remain functional even if the
// underlying functions change names in the future.
function actionPreview(documentId, fileName, fileType) {
    return viewDocument(documentId, fileName, fileType);
}

function actionProcessAI(documentId) {
    return processWithAI(documentId);
}

function actionManual(documentId) {
    return openManualModal(documentId);
}

function actionDelete(documentId, billId) {
    if (billId) return deleteBill(billId);
    return deleteDocument(documentId);
}

function actionMarkPaid(billId, vendor, outstanding) {
    // Inline quick-pay modal
    const existing = document.getElementById('quick-pay-modal');
    if (existing) existing.remove();

    const today = new Date().toISOString().split('T')[0];
    const modal = document.createElement('div');
    modal.id = 'quick-pay-modal';
    modal.className = 'fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 class="font-semibold text-slate-900">Record Payment</h3>
                <button onclick="document.getElementById('quick-pay-modal').remove()" class="text-slate-400 hover:text-slate-600"><i class="fas fa-times"></i></button>
            </div>
            <div class="p-5 space-y-3">
                <div class="p-3 bg-slate-50 rounded-lg text-sm">
                    <strong>${vendor}</strong> — outstanding: <strong>₹${Number(outstanding).toLocaleString()}</strong>
                </div>
                <div>
                    <label class="block text-xs font-medium text-slate-600 mb-1">Amount Paid (₹) *</label>
                    <input type="number" id="qp-amount" value="${outstanding}" min="1" step="0.01" class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                </div>
                <div>
                    <label class="block text-xs font-medium text-slate-600 mb-1">Payment Date *</label>
                    <input type="date" id="qp-date" value="${today}" class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                </div>
                <div>
                    <label class="block text-xs font-medium text-slate-600 mb-1">Payment Method</label>
                    <select id="qp-method" class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                        <option value="CASH">Cash</option>
                        <option value="UPI" selected>UPI</option>
                        <option value="BANK_TRANSFER">Bank Transfer</option>
                        <option value="CHEQUE">Cheque</option>
                        <option value="OTHER">Other</option>
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-medium text-slate-600 mb-1">Reference / Notes</label>
                    <input type="text" id="qp-notes" placeholder="UTR no., cheque no., etc." class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                </div>
            </div>
            <div class="px-5 py-4 border-t border-slate-100 flex gap-3 justify-end">
                <button onclick="document.getElementById('quick-pay-modal').remove()" class="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200">Cancel</button>
                <button id="qp-submit" onclick="submitQuickPay(${billId})" class="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
                    <i class="fas fa-check mr-1"></i>Record Payment
                </button>
            </div>
        </div>`;
    document.body.appendChild(modal);
}

async function submitQuickPay(billId) {
    const amount = parseFloat(document.getElementById('qp-amount').value);
    const date = document.getElementById('qp-date').value;
    const method = document.getElementById('qp-method').value;
    const notes = document.getElementById('qp-notes').value;
    if (!amount || !date) { showToast('Amount and date are required'); return; }

    const btn = document.getElementById('qp-submit');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    try {
        const res = await authFetch(`${API_URL}/payments/record-simple`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bill_id: billId, amount, payment_date: date, payment_method: method, notes })
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('quick-pay-modal').remove();
            showToast('Payment recorded — bill marked paid');
            await loadDocuments();
        } else {
            showToast('Error: ' + (data.error || 'Unknown'));
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-check mr-1"></i>Record Payment';
        }
    } catch (e) {
        showToast('Network error, please retry');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check mr-1"></i>Record Payment';
    }
}

function actionDownload(documentId) {
    return downloadDocument(documentId);
}

document.addEventListener('DOMContentLoaded', () => {
    // Apply URL query params as initial filters
    const urlParams = new URLSearchParams(window.location.search);
    const qGroup   = urlParams.get('filter_group');
    const qStatus  = urlParams.get('status');
    const qDrop    = urlParams.get('drop');
    const qSection = urlParams.get('section');
    const qFrom    = urlParams.get('from');
    const qTo      = urlParams.get('to');
    if (qGroup) {
        const el = document.getElementById('filter-group');
        if (el) el.value = qGroup;
    }
    if (qStatus) {
        const el = document.getElementById('filter-status');
        if (el) el.value = qStatus;
    }
    if (qDrop) {
        window._pendingDropFilter = qDrop;
    }
    if (qSection) {
        const el = document.getElementById('filter-section');
        if (el) el.value = qSection;
    }
    if (qFrom) {
        const el = document.getElementById('date-from');
        if (el) el.value = qFrom;
    }
    if (qTo) {
        const el = document.getElementById('date-to');
        if (el) el.value = qTo;
    }
    const qFlag = urlParams.get('flag');
    if (qFlag) {
        const el = document.getElementById('filter-flag');
        if (el) el.value = qFlag;
    }
    const qSearch = urlParams.get('q');
    if (qSearch) {
        const el = document.getElementById('search-box');
        if (el) el.value = qSearch;
    }

    const qDoc  = urlParams.get('doc');
    const qBill = urlParams.get('bill');

    const afterLoad = () => {
        if (qDoc) {
            const docId = parseInt(qDoc, 10);
            if (docId) setTimeout(() => openManualModal(docId), 300);
        } else if (qBill) {
            // Find document by bill_id and open its detail panel
            const billId = parseInt(qBill, 10);
            if (billId) {
                setTimeout(() => {
                    const match = allDocuments.find(d => d.bill_id === billId);
                    if (match) selectDocument(match.document_id);
                }, 300);
            }
        }
    };

    if (window.sessionReady) {
        window.sessionReady.then(() => loadDocuments().then(afterLoad)).catch(() => {});
    } else {
        loadDocuments().then(afterLoad);
    }
    if (bus && bus.subscribe) {
        bus.subscribe(bus.EVENTS.DATA_CHANGED, () => loadDocuments());
    }
    const payTypeEl = document.getElementById('manual-pay-type');
    if (payTypeEl) {
        payTypeEl.addEventListener('change', syncManualPaymentFields);
    }
    ['manual-advance', 'manual-total', 'manual-due-date'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', updateManualAdvanceSummary);
            el.addEventListener('change', updateManualAdvanceSummary);
        }
    });
});
