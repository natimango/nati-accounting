const API_URL = '/api';
let selectedFile = null;
let fileQueue = []; // batch upload queue

function togglePaymentFields() {
    const status = document.getElementById('payment_status')?.value;
    document.getElementById('advance-fields')?.classList.toggle('hidden', status !== 'advance');
    document.getElementById('due-fields')?.classList.toggle('hidden', status !== 'pending');
}

// Load real drops into the drop selector
async function loadDrops() {
    try {
        const r = await authFetch(`${API_URL}/meta/drops`);
        const data = await r.json();
        const drops = data.drops || data || [];
        const sel = document.getElementById('drop_name');
        sel.innerHTML = '<option value="Unassigned">Unassigned</option>';
        drops.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.drop_name || d.name;
            opt.textContent = d.drop_number ? `#${d.drop_number} – ${d.drop_name || d.name}` : (d.drop_name || d.name);
            sel.appendChild(opt);
        });
    } catch (e) { /* keep static fallback */ }
}
document.addEventListener('DOMContentLoaded', loadDrops);

function authFetch(url, options = {}) {
    const opts = Object.assign({ credentials: 'include' }, options);
    return fetch(url, opts);
}

// File input change handler
document.getElementById('file-input').addEventListener('change', handleFileSelect);

// Drag and drop handlers
const dropZone = document.getElementById('drop-zone');

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('border-indigo-500', 'bg-indigo-50');
});

dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-indigo-500', 'bg-indigo-50');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-indigo-500', 'bg-indigo-50');
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 1) {
        addToQueue(files);
    } else if (files.length === 1) {
        handleFile(files[0]);
    }
});

// Allow click-to-open only when the container itself is clicked to avoid double-open with label
dropZone.addEventListener('click', (e) => {
    if (e.target === dropZone) {
        document.getElementById('file-input').click();
    }
});

function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    if (files.length > 1) {
        addToQueue(files);
        e.target.value = '';
    } else if (files.length === 1) {
        handleFile(files[0]);
    }
}

function handleFile(file) {
    // Validate file
    const maxSize = 25 * 1024 * 1024; // 25MB
    const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
        'application/msword', // .doc
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // .docx
    ];
    const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'xlsx', 'xls', 'doc', 'docx'];
    const fileExtension = (file.name || '').split('.').pop().toLowerCase();
    
    if (file.size > maxSize) {
        showMessage('File too large. Maximum size is 25MB.', 'error');
        return;
    }
    
    if (!allowedExtensions.includes(fileExtension)) {
        showMessage('Invalid file type. Only PDF, JPG, PNG, Excel (XLS/XLSX), and Word (DOC/DOCX) are allowed.', 'error');
        return;
    }

    if (file.type && file.type !== 'application/octet-stream' && !allowedTypes.includes(file.type)) {
        showMessage('Invalid file type. Only PDF, JPG, PNG, Excel (XLS/XLSX), and Word (DOC/DOCX) are allowed.', 'error');
        return;
    }
    
    selectedFile = file;
    displayFileInfo(file);
    document.getElementById('upload-btn').disabled = false;
}

function displayFileInfo(file) {
    const fileInfo = document.getElementById('file-info');
    const fileIcon = document.getElementById('file-icon');
    const fileName = document.getElementById('file-name');
    const fileSize = document.getElementById('file-size');
    const fileType = document.getElementById('file-type');
    
    // Set icon and color based on file type
    const iconInfo = getFileIconInfo(file.type, file.name);
    fileIcon.className = `fas ${iconInfo.icon} ${iconInfo.color} text-3xl mr-4`;
    
    fileName.textContent = file.name;
    fileSize.textContent = formatBytes(file.size);
    fileType.textContent = iconInfo.label;
    
    fileInfo.classList.remove('hidden');
}

function getFileIconInfo(mimeType, fileName) {
    // PDF
    if (mimeType.includes('pdf') || fileName.toLowerCase().endsWith('.pdf')) {
        return { icon: 'fa-file-pdf', color: 'text-red-500', label: 'PDF' };
    }
    
    // Images
    if (
        mimeType.includes('image') ||
        fileName.toLowerCase().endsWith('.jpg') ||
        fileName.toLowerCase().endsWith('.jpeg') ||
        fileName.toLowerCase().endsWith('.png')
    ) {
        return { icon: 'fa-file-image', color: 'text-blue-500', label: 'Image' };
    }
    
    // Excel
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || 
        fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        return { icon: 'fa-file-excel', color: 'text-green-600', label: 'Excel' };
    }
    
    // Word
    if (mimeType.includes('wordprocessing') || mimeType.includes('msword') || 
        fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
        return { icon: 'fa-file-word', color: 'text-blue-600', label: 'Word' };
    }
    
    return { icon: 'fa-file-alt', color: 'text-gray-500', label: 'Document' };
}

function clearFile() {
    selectedFile = null;
    document.getElementById('file-input').value = '';
    document.getElementById('file-info').classList.add('hidden');
    document.getElementById('upload-btn').disabled = true;
    document.getElementById('message-container').classList.add('hidden');
}

async function uploadFile() {
    if (!selectedFile) {
        showMessage('Please select a file', 'error');
        return;
    }
    
    const category = document.getElementById('category').value;
    const dropName = document.getElementById('drop_name') ? document.getElementById('drop_name').value : '';
    if (!category) {
        showMessage('Please select a category', 'error');
        return;
    }
    if (!dropName) {
        showMessage('Please select a drop/collection', 'error');
        return;
    }
    
    const notes = document.getElementById('notes').value;
    const paymentMethod = document.getElementById('payment_method') ? document.getElementById('payment_method').value : 'UNSPECIFIED';
    if (!paymentMethod || paymentMethod === 'UNSPECIFIED') {
        showMessage('Please select a payment method', 'error');
        return;
    }
    const paymentStatus = document.getElementById('payment_status')?.value || 'paid';
    const advancePct = paymentStatus === 'advance' ? (parseFloat(document.getElementById('advance_percentage')?.value) || null) : null;
    const dueDate = paymentStatus === 'advance'
        ? (document.getElementById('due_date')?.value || null)
        : paymentStatus === 'pending'
            ? (document.getElementById('due_date_pending')?.value || null)
            : null;

    const section = document.getElementById('section')?.value || '';

    // Prepare form data
    const formData = new FormData();
    formData.append('bill', selectedFile);
    formData.append('category', category);
    formData.append('drop_name', dropName);
    formData.append('notes', notes);
    formData.append('payment_method', paymentMethod);
    formData.append('payment_status', paymentStatus);
    if (section) formData.append('section', section);
    if (advancePct) formData.append('advance_percentage', advancePct);
    if (dueDate) formData.append('due_date', dueDate);
    
    // Show progress
    document.getElementById('upload-btn').disabled = true;
    document.getElementById('upload-btn').innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Uploading...';
    document.getElementById('progress-container').classList.remove('hidden');
    
    // Simulate progress (since we can't track real progress easily)
    let progress = 0;
    const progressInterval = setInterval(() => {
        progress += 10;
        if (progress <= 90) {
            document.getElementById('progress-bar').style.width = progress + '%';
            document.getElementById('progress-text').textContent = progress + '%';
        }
    }, 200);
    
    try {
        const response = await authFetch(`${API_URL}/upload`, {
            method: 'POST',
            body: formData
        });
        
        clearInterval(progressInterval);
        document.getElementById('progress-bar').style.width = '100%';
        document.getElementById('progress-text').textContent = '100%';
        
        const data = await response.json();
        
        if (data.success) {
            showMessage(`✅ ${selectedFile.name} uploaded — ready for next bill`, 'success');
            addSessionUpload({ name: selectedFile.name, drop: dropName, category, doc: data.document || data });
            clearFile();
            document.getElementById('progress-container').classList.add('hidden');
            document.getElementById('upload-btn').disabled = false;
            document.getElementById('upload-btn').innerHTML = '<i class="fas fa-upload mr-1"></i>Upload Bill';
        } else {
            showMessage('Upload failed: ' + data.error, 'error');
            document.getElementById('upload-btn').disabled = false;
            document.getElementById('upload-btn').innerHTML = '<i class="fas fa-upload mr-1"></i>Upload Bill';
        }
    } catch (error) {
        clearInterval(progressInterval);
        console.error('Upload error:', error);
        showMessage('Upload failed. Please try again.', 'error');
        document.getElementById('upload-btn').disabled = false;
        document.getElementById('upload-btn').innerHTML = '<i class="fas fa-upload mr-2"></i>Upload Bill';
    }
}

// ── Batch queue ────────────────────────────────────────────────────────────────
function addToQueue(files) {
    const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'xlsx', 'xls', 'doc', 'docx'];
    const valid = files.filter(f => allowedExtensions.includes(f.name.split('.').pop().toLowerCase()) && f.size <= 25 * 1024 * 1024);
    const invalid = files.length - valid.length;
    if (!valid.length) { showMessage('No valid files in selection (PDF, JPG, PNG, Excel, Word; max 25MB each)', 'error'); return; }
    valid.forEach(f => fileQueue.push({ file: f, status: 'queued' }));
    renderQueue();
    if (invalid > 0) showMessage(`${invalid} file(s) skipped (unsupported type or too large)`, 'error');
}

function renderQueue() {
    let wrap = document.getElementById('batch-queue-wrap');
    if (!wrap) {
        wrap = document.createElement('div');
        wrap.id = 'batch-queue-wrap';
        // Insert after drop-zone
        const dz = document.getElementById('drop-zone');
        dz.parentNode.insertBefore(wrap, dz.nextSibling);
    }
    if (!fileQueue.length) { wrap.innerHTML = ''; return; }
    const rows = fileQueue.map((q, i) => {
        const icon = q.status === 'done' ? 'fa-check-circle text-emerald-500' : q.status === 'error' ? 'fa-times-circle text-red-500' : q.status === 'uploading' ? 'fa-spinner fa-spin text-indigo-400' : 'fa-clock text-slate-300';
        const label = q.status === 'done' ? 'Done' : q.status === 'error' ? 'Failed' : q.status === 'uploading' ? 'Uploading…' : 'Queued';
        const rmBtn = q.status === 'queued' ? `<button onclick="removeFromQueue(${i})" class="text-slate-300 hover:text-red-400 text-xs"><i class="fas fa-times"></i></button>` : '';
        return `<div class="flex items-center gap-2 py-1 border-b border-slate-100 last:border-0">
            <i class="fas ${icon}"></i>
            <span class="flex-1 text-xs text-slate-700 truncate">${q.file.name}</span>
            <span class="text-xs text-slate-400">${(q.file.size/1024).toFixed(0)}KB</span>
            <span class="text-xs font-medium text-slate-500">${label}</span>
            ${rmBtn}
        </div>`;
    }).join('');
    const allDone = fileQueue.every(q => q.status === 'done' || q.status === 'error');
    const hasQueued = fileQueue.some(q => q.status === 'queued');
    wrap.innerHTML = `<div class="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
        <div class="flex items-center justify-between mb-2">
            <p class="text-xs font-semibold text-slate-600 uppercase tracking-wide"><i class="fas fa-layer-group mr-1 text-indigo-400"></i>Batch Queue (${fileQueue.length} files)</p>
            ${allDone ? `<button onclick="fileQueue=[];renderQueue()" class="text-xs text-slate-400 hover:text-red-500">Clear</button>` : ''}
        </div>
        <div class="space-y-0 max-h-48 overflow-y-auto">${rows}</div>
        ${hasQueued ? `<button onclick="uploadBatch()" id="batch-upload-btn" class="mt-3 w-full px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 flex items-center justify-center gap-2"><i class="fas fa-cloud-upload-alt"></i>Upload All (${fileQueue.filter(q=>q.status==='queued').length} files)</button>` : ''}
    </div>`;
}

function removeFromQueue(idx) {
    fileQueue.splice(idx, 1);
    renderQueue();
}

async function uploadBatch() {
    const category = document.getElementById('category').value;
    const dropName = document.getElementById('drop_name')?.value || '';
    const paymentMethod = document.getElementById('payment_method')?.value || 'UNSPECIFIED';
    if (!category) { showMessage('Select a category before batch upload', 'error'); return; }
    if (!dropName) { showMessage('Select a drop before batch upload', 'error'); return; }
    if (!paymentMethod || paymentMethod === 'UNSPECIFIED') { showMessage('Select a payment method before batch upload', 'error'); return; }

    const notes = document.getElementById('notes')?.value || '';
    const paymentStatus = document.getElementById('payment_status')?.value || 'paid';
    const advancePct = paymentStatus === 'advance' ? (parseFloat(document.getElementById('advance_percentage')?.value) || null) : null;
    const dueDate = paymentStatus === 'advance'
        ? (document.getElementById('due_date')?.value || null)
        : paymentStatus === 'pending'
            ? (document.getElementById('due_date_pending')?.value || null)
            : null;
    const section = document.getElementById('section')?.value || '';

    const btn = document.getElementById('batch-upload-btn');
    if (btn) btn.disabled = true;

    for (let i = 0; i < fileQueue.length; i++) {
        const q = fileQueue[i];
        if (q.status !== 'queued') continue;
        q.status = 'uploading';
        renderQueue();
        try {
            const formData = new FormData();
            formData.append('bill', q.file);
            formData.append('category', category);
            formData.append('drop_name', dropName);
            formData.append('notes', notes);
            formData.append('payment_method', paymentMethod);
            formData.append('payment_status', paymentStatus);
            if (section) formData.append('section', section);
            if (advancePct) formData.append('advance_percentage', advancePct);
            if (dueDate) formData.append('due_date', dueDate);
            const resp = await authFetch(`${API_URL}/upload`, { method: 'POST', body: formData });
            const data = await resp.json();
            if (data.success) {
                q.status = 'done';
                addSessionUpload({ name: q.file.name, drop: dropName, category, doc: data.document || data });
            } else {
                q.status = 'error';
            }
        } catch (_) {
            q.status = 'error';
        }
        renderQueue();
    }
    const done = fileQueue.filter(q => q.status === 'done').length;
    const failed = fileQueue.filter(q => q.status === 'error').length;
    showMessage(`Batch complete: ${done} uploaded${failed ? ', ' + failed + ' failed' : ''}`, failed ? 'error' : 'success');
}

function showMessage(message, type) {
    const container = document.getElementById('message-container');
    const bgColor = type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800';
    const icon = type === 'success' ? 'check-circle' : 'exclamation-circle';
    
    container.innerHTML = `
        <div class="border ${bgColor} rounded-lg p-4">
            <div class="flex items-center">
                <i class="fas fa-${icon} mr-3"></i>
                <span>${message}</span>
            </div>
        </div>
    `;
    container.classList.remove('hidden');
    
    if (type === 'error') {
        document.getElementById('progress-container').classList.add('hidden');
    }
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// ── Session upload history ────────────────────────────────────────────────────
const _sessionUploads = [];

function addSessionUpload(info) {
    _sessionUploads.unshift({ ...info, time: new Date() });
    const wrap = document.getElementById('session-uploads');
    const list = document.getElementById('session-upload-list');
    if (!wrap || !list) return;
    wrap.classList.remove('hidden');
    list.innerHTML = _sessionUploads.map((u, i) => {
        const docId = u.doc?.document_id || u.doc?.id;
        const docLink = docId ? `<a href="documents.html?doc=${docId}" class="text-xs text-indigo-500 hover:underline ml-2" title="View document"><i class="fas fa-arrow-up-right-from-square"></i></a>` : '';
        return `<div class="flex items-center justify-between gap-3 text-sm ${i > 0 ? 'border-t border-slate-100 pt-2 mt-2' : ''}">
            <div class="flex-1 min-w-0">
                <p class="font-medium text-slate-800 truncate">${u.name}${docLink}</p>
                <p class="text-xs text-slate-400">${u.drop || '—'} · ${(u.category || '').replace(/_/g,' ')}</p>
            </div>
            <span class="text-xs text-emerald-600 font-semibold shrink-0"><i class="fas fa-check-circle mr-1"></i>Uploaded</span>
        </div>`;
    }).join('');
}
