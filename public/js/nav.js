// Top-nav with dropdown — injected into every page
(function () {
  'use strict';

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
      if (l.group) { cur = { name: l.group, links: [] }; groups.push(cur); }
      else if (cur) cur.links.push(l);
    });
    return groups;
  }

  function buildNav() {
    var topbar = document.querySelector('.app-topbar');
    if (!topbar) return;

    var page = currentPage();
    var titleEl = topbar.querySelector('.topbar-title');
    var titleText = titleEl ? titleEl.textContent.trim() : 'NATI Finance';

    // Rebuild topbar
    topbar.innerHTML =
      '<a href="index.html" class="nt-logo">' +
        '<img src="/logo.jpg" alt="NATI">' +
        '<span class="nt-logo-text">NATI Finance</span>' +
      '</a>' +
      '<div class="nt-divider"></div>' +
      '<span class="nt-page-title">' + titleText + '</span>' +
      '<div class="nt-right">' +
        (page !== 'upload.html' ?
          '<a href="upload.html" class="nt-upload-btn">' +
            '<i class="fas fa-plus"></i>' +
            '<span>Upload</span>' +
          '</a>' : '') +
        '<button class="nt-user-pill" id="nt-user-pill" title="Account">' +
          '<span class="nt-avatar" id="nt-avatar">?</span>' +
          '<span class="nt-user-name" id="nt-user-name"></span>' +
        '</button>' +
        '<button class="nt-menu-btn" id="nt-menu-btn" aria-label="Navigation menu" aria-expanded="false">' +
          '<i class="fas fa-bars" id="nt-menu-icon"></i>' +
        '</button>' +
      '</div>';

    // Build dropdown panel
    var groups = buildGroups();
    var groupsHtml = groups.map(function (g) {
      var linksHtml = g.links.map(function (l) {
        var active = page === l.href ? ' active' : '';
        var adminAttr = l.adminOnly ? ' id="nav-admin" style="display:none"' : '';
        return '<a href="' + l.href + '" class="nt-dd-link' + active + '"' + adminAttr + '>' +
          '<i class="fas ' + l.icon + ' nt-dd-icon"></i>' +
          '<span>' + l.label + '</span>' +
        '</a>';
      }).join('');
      return '<div class="nt-dd-group">' +
        '<div class="nt-dd-group-label">' + g.name + '</div>' +
        linksHtml +
      '</div>';
    }).join('');

    var dropdown = document.createElement('div');
    dropdown.className = 'nt-dropdown';
    dropdown.id = 'nt-dropdown';
    dropdown.setAttribute('aria-hidden', 'true');
    dropdown.innerHTML = '<div class="nt-dd-inner">' + groupsHtml + '</div>';
    topbar.after(dropdown);

    // Wire toggle
    var menuBtn = document.getElementById('nt-menu-btn');
    var menuIcon = document.getElementById('nt-menu-icon');

    function closeDropdown() {
      dropdown.classList.remove('open');
      dropdown.setAttribute('aria-hidden', 'true');
      menuBtn.setAttribute('aria-expanded', 'false');
      if (menuIcon) { menuIcon.className = 'fas fa-bars'; }
    }

    function openDropdown() {
      dropdown.classList.add('open');
      dropdown.setAttribute('aria-hidden', 'false');
      menuBtn.setAttribute('aria-expanded', 'true');
      if (menuIcon) { menuIcon.className = 'fas fa-xmark'; }
    }

    if (menuBtn) {
      menuBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (dropdown.classList.contains('open')) { closeDropdown(); } else { openDropdown(); }
      });
    }

    document.addEventListener('click', function (e) {
      if (!dropdown.contains(e.target) && menuBtn && !menuBtn.contains(e.target)) {
        closeDropdown();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeDropdown();
    });

    dropdown.querySelectorAll('.nt-dd-link').forEach(function (a) {
      a.addEventListener('click', closeDropdown);
    });
  }

  function updateNavUser(user) {
    var nameEl   = document.getElementById('nt-user-name');
    var avatarEl = document.getElementById('nt-avatar');
    var adminLink = document.getElementById('nav-admin');
    var pill      = document.getElementById('nt-user-pill');

    if (nameEl) {
      var first = (user.name || user.email || '').split(' ')[0];
      nameEl.textContent = first;
    }
    if (avatarEl) {
      var n = user.name || user.email || '?';
      avatarEl.textContent = n.split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
    }
    if (adminLink && user.role === 'admin') adminLink.style.display = '';

    if (pill) {
      pill.addEventListener('click', function () {
        window._openChangePwd && window._openChangePwd();
      });
    }
  }

  function init() {
    if (/\/login\.html$/i.test(window.location.pathname)) return;
    buildNav();

    if (window.sessionReady) {
      window.sessionReady.then(updateNavUser).catch(function () {});
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

  window.toggleNav = function () {};
  window.closeNav  = function () {};
}());
