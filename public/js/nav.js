// Sidebar navigation — injected into every page
(function() {
  const LINKS = [
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

  function buildSidebar() {
    const page = currentPage();
    const linksHtml = LINKS.map(function(l) {
      if (l.group) return '<div class="sb-group-label">' + l.group + '</div>';
      const active = page === l.href ? ' active' : '';
      const adminAttr = l.adminOnly ? ' id="nav-admin" style="display:none"' : '';
      return '<a href="' + l.href + '" class="sb-link' + active + '"' + adminAttr + '>' +
        '<i class="fas ' + l.icon + ' sb-icon"></i>' +
        '<span class="sb-label">' + l.label + '</span>' +
        '</a>';
    }).join('');

    var sidebar = document.createElement('aside');
    sidebar.className = 'app-sidebar';
    sidebar.id = 'app-sidebar';
    sidebar.innerHTML =
      '<a href="index.html" class="sb-logo">' +
        '<img src="/logo.jpg" alt="NATI">' +
        '<span class="sb-logo-text">NATI Finance</span>' +
      '</a>' +
      '<nav class="sb-nav">' + linksHtml + '</nav>' +
      '<div class="sb-footer">' +
        '<div class="sb-user" id="sb-user-btn" title="Account">' +
          '<div class="sb-avatar" id="sb-avatar">?</div>' +
          '<div class="sb-user-info">' +
            '<div class="sb-user-name" id="sb-user-name">Loading…</div>' +
            '<div class="sb-user-role" id="sb-user-role"></div>' +
          '</div>' +
          '<button class="sb-logout" id="sb-logout-btn" title="Sign out">' +
            '<i class="fas fa-sign-out-alt"></i>' +
          '</button>' +
        '</div>' +
      '</div>';

    var overlay = document.createElement('div');
    overlay.className = 'sb-overlay';
    overlay.id = 'sb-overlay';

    document.body.insertBefore(sidebar, document.body.firstChild);
    document.body.insertBefore(overlay, sidebar.nextSibling);

    // Collapse state from localStorage
    if (localStorage.getItem('sb-collapsed') === '1' && window.innerWidth > 767) {
      sidebar.classList.add('collapsed');
      var content = document.querySelector('.app-content');
      if (content) content.classList.add('sidebar-collapsed');
    }

    // Toggle collapse (desktop) / open (mobile)
    document.addEventListener('click', function(e) {
      var toggle = e.target.closest('#topbar-toggle');
      if (!toggle) return;
      if (window.innerWidth <= 767) {
        var open = sidebar.classList.toggle('open');
        overlay.classList.toggle('active', open);
      } else {
        var collapsed = sidebar.classList.toggle('collapsed');
        var contentEl = document.querySelector('.app-content');
        if (contentEl) contentEl.classList.toggle('sidebar-collapsed', collapsed);
        localStorage.setItem('sb-collapsed', collapsed ? '1' : '0');
      }
    });

    // Close on overlay click
    overlay.addEventListener('click', function() {
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
    });

    // Close on nav link click (mobile)
    sidebar.querySelectorAll('.sb-link').forEach(function(a) {
      a.addEventListener('click', function() {
        if (window.innerWidth <= 767) {
          sidebar.classList.remove('open');
          overlay.classList.remove('active');
        }
      });
    });
  }

  function updateSidebarUser(user) {
    var nameEl = document.getElementById('sb-user-name');
    var roleEl = document.getElementById('sb-user-role');
    var avatarEl = document.getElementById('sb-avatar');
    var logoutBtn = document.getElementById('sb-logout-btn');
    var adminLink = document.getElementById('nav-admin');

    if (nameEl) nameEl.textContent = user.name || user.email || '';
    if (roleEl) roleEl.textContent = user.role || '';
    if (avatarEl) {
      var n = user.name || user.email || '?';
      avatarEl.textContent = n.split(' ').map(function(w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
    }
    if (adminLink && user.role === 'admin') adminLink.style.display = '';

    var userBtn = document.getElementById('sb-user-btn');
    if (userBtn) {
      userBtn.addEventListener('click', function(e) {
        if (e.target.closest('#sb-logout-btn')) return;
        window._openChangePwd && window._openChangePwd();
      });
    }
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async function() {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(function() {});
        window.location.href = 'login.html';
      });
    }

    // Hide legacy elements
    ['user-name','user-role','logout-btn','user-pill'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });
  }

  function init() {
    if (/\/login\.html$/i.test(window.location.pathname)) return;
    buildSidebar();
    if (window.sessionReady) {
      window.sessionReady.then(updateSidebarUser).catch(function() {});
    } else {
      document.addEventListener('DOMContentLoaded', function() {
        if (window.sessionReady) window.sessionReady.then(updateSidebarUser).catch(function() {});
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(function() {});
  }

  // Keep toggleNav working for any legacy references
  window.toggleNav = function() {};
  window.closeNav = function() {};
})();
