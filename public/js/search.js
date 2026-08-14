// Global command palette — Ctrl+K or Cmd+K to open
(function () {
  let _overlay = null, _input = null, _results = null, _timer = null, _selected = -1, _items = [];

  function open() {
    if (_overlay) { _input.value = ''; renderResults([]); _overlay.classList.remove('hidden'); _input.focus(); return; }
    _overlay = document.createElement('div');
    _overlay.id = 'search-palette';
    _overlay.className = 'fixed inset-0 z-[9999] flex items-start justify-center pt-[10vh] bg-black/50 backdrop-blur-sm';
    _overlay.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-4 overflow-hidden" onclick="event.stopPropagation()">
        <div class="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <i class="fas fa-search text-slate-400"></i>
          <input id="palette-input" type="text" placeholder="Search vendors, bills, files…"
            class="flex-1 text-sm bg-transparent outline-none placeholder-slate-400" autocomplete="off">
          <kbd class="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">ESC</kbd>
        </div>
        <div id="palette-results" class="max-h-[380px] overflow-y-auto py-2">
          <p class="text-xs text-slate-400 text-center py-6">Type to search…</p>
        </div>
      </div>`;
    document.body.appendChild(_overlay);
    _input = document.getElementById('palette-input');
    _results = document.getElementById('palette-results');
    _overlay.addEventListener('click', close);
    _input.addEventListener('input', onInput);
    _input.addEventListener('keydown', onKey);
    _input.focus();
  }

  function close() {
    if (_overlay) { _overlay.classList.add('hidden'); _input.value = ''; renderResults([]); }
  }

  function onInput() {
    clearTimeout(_timer);
    const q = _input.value.trim();
    if (!q || q.length < 2) { renderResults([]); return; }
    _timer = setTimeout(() => doSearch(q), 200);
  }

  async function doSearch(q) {
    try {
      const resp = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { credentials: 'include' }).then(r => r.json());
      if (resp.success) renderResults(resp.results || []);
    } catch (e) { /* silent */ }
  }

  const ICONS = { vendor: 'fa-building', bill: 'fa-receipt', doc: 'fa-file' };
  const LABELS = { vendor: 'Vendor', bill: 'Bill', doc: 'File' };

  function renderResults(items) {
    _items = items;
    _selected = -1;
    if (!items.length) {
      _results.innerHTML = `<p class="text-xs text-slate-400 text-center py-6">${_input.value.trim().length >= 2 ? 'No results found' : 'Type to search…'}</p>`;
      return;
    }
    _results.innerHTML = items.map((item, i) => `
      <a href="${item.href}" id="pr-${i}" onclick="close()"
         class="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors group">
        <div class="w-7 h-7 rounded-lg bg-slate-100 group-hover:bg-indigo-50 flex items-center justify-center flex-shrink-0">
          <i class="fas ${ICONS[item.type] || 'fa-circle'} text-slate-400 group-hover:text-indigo-500 text-xs"></i>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm text-slate-800 truncate">${escPalette(item.label)}</p>
          ${item.sub ? `<p class="text-xs text-slate-400">${escPalette(item.sub)}</p>` : ''}
        </div>
        <span class="text-[10px] text-slate-300 uppercase tracking-wide">${LABELS[item.type] || item.type}</span>
      </a>`).join('');
  }

  function escPalette(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function onKey(e) {
    const rows = _results.querySelectorAll('a');
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'ArrowDown') {
      _selected = Math.min(_selected + 1, rows.length - 1);
      rows.forEach((r, i) => r.classList.toggle('bg-slate-100', i === _selected));
      if (rows[_selected]) rows[_selected].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      _selected = Math.max(_selected - 1, -1);
      rows.forEach((r, i) => r.classList.toggle('bg-slate-100', i === _selected));
      if (_selected >= 0 && rows[_selected]) rows[_selected].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && _selected >= 0 && rows[_selected]) {
      rows[_selected].click();
    }
  }

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); open(); }
  });

  window._searchPaletteOpen = open;
  window._searchPaletteClose = close;
})();
