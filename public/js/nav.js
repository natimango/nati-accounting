// ─── NATI Navigation ────────────────────────────────────────────────────────
// Injects topbar + hamburger dropdown on every page except login/upload-mobile
(function () {
  'use strict';

  // Force light theme — app runs light-only
  document.documentElement.setAttribute('data-theme', 'light');

  // ── Global apiFetch — available as window.apiFetch on every page ─────────────
  window.apiFetch = async function apiFetch(url, options) {
    options = options || {};
    var resp = await fetch(url, Object.assign({ credentials: 'include' }, options, {
      headers: Object.assign({ 'Content-Type': 'application/json' }, options.headers || {})
    }));
    if (resp.status === 401) { window.location.href = '/login.html'; return Promise.reject(new Error('Unauthorized')); }
    if (!resp.ok) { var t = await resp.text(); throw new Error(t || ('Request failed ' + resp.status)); }
    var ct = resp.headers.get('content-type') || '';
    return ct.includes('application/json') ? resp.json() : resp.text();
  };

  var LINKS = [
    { group: 'Overview' },
    { href: 'index.html',            icon: 'fa-gauge',               label: 'Dashboard' },
    { href: 'reports.html',          icon: 'fa-chart-line',          label: 'Reports & P&L' },
    { href: 'drop.html',             icon: 'fa-layer-group',         label: 'Drops' },
    { group: 'Finance' },
    { href: 'documents.html',        icon: 'fa-folder-open',         label: 'Bills & Docs' },
    { href: 'payables.html',         icon: 'fa-file-invoice-dollar', label: 'Payables' },
    { href: 'accounts.html',         icon: 'fa-book',                label: 'Accounts' },
    { href: 'balance-sheet.html',    icon: 'fa-scale-balanced',      label: 'Balance Sheet' },
    { href: 'cashflow.html',         icon: 'fa-water',               label: 'Cash Flow' },
    { group: 'Operations' },
    { href: 'upload.html',           icon: 'fa-upload',              label: 'Upload Bill' },
    { href: 'vendors.html',          icon: 'fa-building',            label: 'Vendors' },
    { href: 'sales.html',            icon: 'fa-store',               label: 'Sales' },
    { href: 'sku-catalog.html',      icon: 'fa-tags',                label: 'SKU Catalog' },
    { href: 'garment-economics.html',icon: 'fa-shirt',               label: 'Garment P&L' },
    { group: 'System' },
    { href: 'alerts.html',           icon: 'fa-triangle-exclamation',label: 'Alerts' },
    { href: 'quality.html',          icon: 'fa-shield-check',        label: 'Data Quality' },
    { href: 'admin.html',            icon: 'fa-user-shield',         label: 'Admin', adminOnly: true },
  ];

  function currentPage() {
    return window.location.pathname.split('/').pop() || 'index.html';
  }

  function buildGroups() {
    var groups = [];
    var cur = null;
    LINKS.forEach(function (l) {
      if (l.group) {
        cur = { name: l.group, links: [] };
        groups.push(cur);
      } else if (cur) {
        cur.links.push(l);
      }
    });
    return groups;
  }

  function buildNav() {
    var topbar = document.querySelector('.app-topbar');
    if (!topbar) return;

    var page      = currentPage();
    var titleEl   = topbar.querySelector('.topbar-title');
    var titleText = titleEl ? titleEl.textContent.trim() : 'NATI Finance';
    var isUpload  = page === 'upload.html';

    // ── Topbar ──────────────────────────────────────────────────────────────
    topbar.innerHTML =
      '<a href="index.html" class="nt-logo">' +
        '<img src="/logo.jpg" alt="NATI">' +
        '<span class="nt-logo-text">NATI Finance</span>' +
      '</a>' +
      '<div class="nt-divider"></div>' +
      '<span class="nt-page-title">' + titleText + '</span>' +
      '<div class="nt-right">' +
        (!isUpload
          ? '<a href="upload.html" class="nt-upload-btn" title="Upload a bill">' +
              '<i class="fas fa-plus"></i><span>Upload</span>' +
            '</a>'
          : '') +
        '<button class="nt-user-pill" id="nt-user-pill" title="Change password">' +
          '<span class="nt-avatar" id="nt-avatar">?</span>' +
          '<span class="nt-uname" id="nt-uname"></span>' +
        '</button>' +
        '<button class="nt-ham" id="nt-ham" aria-label="Open menu" aria-expanded="false" aria-controls="nt-menu">' +
          '<span class="nt-ham-bar"></span>' +
          '<span class="nt-ham-bar"></span>' +
          '<span class="nt-ham-bar"></span>' +
        '</button>' +
      '</div>';

    // ── Dropdown panel ───────────────────────────────────────────────────────
    var groups    = buildGroups();
    var groupsHtml = groups.map(function (g) {
      return '<div class="nt-menu-group">' +
        '<p class="nt-menu-group-label">' + g.name + '</p>' +
        g.links.map(function (l) {
          var active    = page === l.href ? ' nt-active' : '';
          var adminAttr = l.adminOnly ? ' id="nav-admin" style="display:none"' : '';
          return '<a href="' + l.href + '" class="nt-menu-link' + active + '"' + adminAttr + '>' +
            '<span class="nt-menu-icon"><i class="fas ' + l.icon + '"></i></span>' +
            '<span class="nt-menu-label">' + l.label + '</span>' +
            (page === l.href ? '<span class="nt-menu-dot"></span>' : '') +
          '</a>';
        }).join('') +
      '</div>';
    }).join('');

    var menu = document.createElement('nav');
    menu.id        = 'nt-menu';
    menu.className = 'nt-menu';
    menu.setAttribute('aria-hidden', 'true');
    menu.innerHTML =
      '<div class="nt-menu-inner">' +
        '<div class="nt-menu-grid">' + groupsHtml + '</div>' +
        '<div class="nt-menu-footer" id="nt-menu-footer">' +
          '<button id="nt-logout" class="nt-logout-btn">' +
            '<i class="fas fa-arrow-right-from-bracket"></i> Sign out' +
          '</button>' +
        '</div>' +
      '</div>';

    // Scrim
    var scrim = document.createElement('div');
    scrim.className = 'nt-scrim';
    scrim.id        = 'nt-scrim';

    // Insert right after topbar (both fixed, order doesn't matter for layout)
    topbar.after(menu);
    topbar.after(scrim);

    // ── Toggle logic ─────────────────────────────────────────────────────────
    var ham     = document.getElementById('nt-ham');
    var isOpen  = false;

    function open() {
      isOpen = true;
      menu.classList.add('nt-open');
      scrim.classList.add('nt-open');
      ham.setAttribute('aria-expanded', 'true');
      ham.classList.add('nt-ham--open');
      document.body.style.overflow = 'hidden';
    }

    function close() {
      isOpen = false;
      menu.classList.remove('nt-open');
      scrim.classList.remove('nt-open');
      ham.setAttribute('aria-expanded', 'false');
      ham.classList.remove('nt-ham--open');
      document.body.style.overflow = '';
    }

    ham.addEventListener('click', function (e) {
      e.stopPropagation();
      isOpen ? close() : open();
    });

    scrim.addEventListener('click', close);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen) close();
    });

    menu.querySelectorAll('.nt-menu-link').forEach(function (a) {
      a.addEventListener('click', close);
    });

    // Logout
    var logoutBtn = document.getElementById('nt-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
          .catch(function () {})
          .finally(function () { window.location.href = 'login.html'; });
      });
    }
  }

  function updateNavUser(user) {
    var unameEl   = document.getElementById('nt-uname');
    var avatarEl  = document.getElementById('nt-avatar');
    var adminLink = document.getElementById('nav-admin');
    var pill      = document.getElementById('nt-user-pill');
    var footer    = document.getElementById('nt-menu-footer');

    var name = user.name || user.email || '';
    if (unameEl)  unameEl.textContent  = name.split(' ')[0];
    if (avatarEl) avatarEl.textContent = name.split(' ').map(function (w) { return w[0] || ''; }).join('').slice(0, 2).toUpperCase() || '?';
    if (adminLink && user.role === 'admin') adminLink.removeAttribute('style');

    // Show user info in menu footer
    if (footer) {
      var userInfo = document.createElement('div');
      userInfo.className = 'nt-menu-user';
      userInfo.innerHTML =
        '<span class="nt-menu-user-name">' + (user.name || user.email || '') + '</span>' +
        '<span class="nt-menu-user-role">' + (user.role || '') + '</span>';
      footer.insertBefore(userInfo, footer.firstChild);
    }

    if (pill) {
      pill.addEventListener('click', function () {
        window._openChangePwd && window._openChangePwd();
      });
    }
  }

  function init() {
    if (/\/(login|upload-mobile)\.html/i.test(window.location.pathname)) return;
    buildNav();

    var ready = window.sessionReady;
    if (ready && typeof ready.then === 'function') {
      ready.then(updateNavUser).catch(function () {});
    } else {
      document.addEventListener('DOMContentLoaded', function () {
        if (window.sessionReady) window.sessionReady.then(updateNavUser).catch(function () {});
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  }

  // Legacy stubs
  window.toggleNav = function () {};
  window.closeNav  = function () {};
}());
