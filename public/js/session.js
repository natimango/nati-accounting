(() => {
  const LOGIN_PAGE = /\/login\.html$/i.test(window.location.pathname);
  const AUTH_ENDPOINT = '/api/auth/me';

  function redirectToLogin() {
    if (!LOGIN_PAGE) {
      window.location.href = 'login.html';
    }
  }

  async function fetchCurrentUser() {
    const res = await fetch(AUTH_ENDPOINT, { credentials: 'include' });
    if (!res.ok) {
      throw new Error('unauthenticated');
    }
    const data = await res.json();
    if (!data || !data.user) {
      throw new Error('user missing');
    }
    return data.user;
  }

  function applyRoleVisibility(user) {
    const adminNav = document.getElementById('nav-admin');
    if (adminNav) {
      adminNav.classList.toggle('hidden', user.role !== 'admin');
    }

    document.querySelectorAll('[data-role-required]').forEach((el) => {
      const roles = (el.dataset.roleRequired || '')
        .split(',')
        .map((r) => r.trim().toLowerCase())
        .filter(Boolean);
      if (roles.length === 0) return;
      if (roles.includes(user.role)) {
        el.classList.remove('hidden');
        el.removeAttribute('aria-hidden');
      } else {
        el.classList.add('hidden');
        el.setAttribute('aria-hidden', 'true');
      }
    });
  }

  function updateUserBadge(user) {
    const pill = document.getElementById('user-pill');
    const nameEl = document.getElementById('user-name');
    const roleEl = document.getElementById('user-role');
    const logoutBtn = document.getElementById('logout-btn');

    if (pill && nameEl && roleEl) {
      nameEl.textContent = user.name || user.email || '';
      roleEl.textContent = user.role || '';
      pill.classList.remove('hidden');
      pill.title = 'Click to change password';
      pill.style.cursor = 'pointer';
      pill.addEventListener('click', () => window._openChangePwd && window._openChangePwd());
    }

    if (logoutBtn) {
      logoutBtn.classList.remove('hidden');
      logoutBtn.addEventListener('click', async () => {
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include'
        }).catch(() => {});
        window.location.href = 'login.html';
      });
    }
  }

  async function initSession() {
    try {
      const user = await fetchCurrentUser();
      window.currentUser = user;
      applyRoleVisibility(user);
      updateUserBadge(user);
      return user;
    } catch (err) {
      window.currentUser = null;
      redirectToLogin();
      throw err;
    }
  }

  if (!LOGIN_PAGE) {
    window.sessionReady = initSession();
  }

  // Change password modal — injected once, triggered from user pill click
  window._openChangePwd = function() {
    let modal = document.getElementById('_change-pwd-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = '_change-pwd-modal';
      modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center';
      modal.innerHTML = `
        <div style="background:#fff;border-radius:16px;padding:28px;width:100%;max-width:380px;box-shadow:0 20px 60px rgba(0,0,0,0.2)">
          <h3 style="font-size:16px;font-weight:600;margin-bottom:16px">Change Password</h3>
          <div style="margin-bottom:12px">
            <label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px">Current password</label>
            <input id="_cp-current" type="password" style="width:100%;padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box">
          </div>
          <div style="margin-bottom:12px">
            <label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px">New password (min 8 chars)</label>
            <input id="_cp-new" type="password" style="width:100%;padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box">
          </div>
          <div style="margin-bottom:16px">
            <label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px">Confirm new password</label>
            <input id="_cp-confirm" type="password" style="width:100%;padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box">
          </div>
          <p id="_cp-msg" style="font-size:12px;color:#ef4444;min-height:16px;margin-bottom:12px"></p>
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button id="_cp-cancel" style="padding:8px 16px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;cursor:pointer;background:#fff">Cancel</button>
            <button id="_cp-submit" style="padding:8px 16px;background:#4f46e5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">Save</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      document.getElementById('_cp-cancel').onclick = () => modal.remove();
      document.getElementById('_cp-submit').onclick = async () => {
        const cur = document.getElementById('_cp-current').value;
        const nw = document.getElementById('_cp-new').value;
        const conf = document.getElementById('_cp-confirm').value;
        const msg = document.getElementById('_cp-msg');
        if (!cur || !nw) { msg.textContent = 'All fields are required.'; return; }
        if (nw !== conf) { msg.textContent = 'Passwords do not match.'; return; }
        if (nw.length < 8) { msg.textContent = 'New password must be at least 8 characters.'; return; }
        msg.textContent = '';
        try {
          const resp = await fetch('/api/auth/change-password', {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ current_password: cur, new_password: nw })
          }).then(r => r.json());
          if (!resp.success) { msg.textContent = resp.error || 'Failed to change password.'; return; }
          modal.remove();
          alert('Password changed successfully.');
        } catch (e) {
          msg.textContent = 'Network error — try again.';
        }
      };
    }
    document.body.appendChild(modal);
  };

  window.requireRoles = function requireRoles(roles = []) {
    if (!Array.isArray(roles) || roles.length === 0) return;
    if (!window.sessionReady) {
      redirectToLogin();
      return;
    }
    window.sessionReady
      .then((user) => {
        if (!roles.includes(user.role)) {
          window.location.href = 'index.html';
        }
      })
      .catch(() => {});
  };
})();
