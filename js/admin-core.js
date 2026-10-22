// ============================================================
// Takgio admin: the shared core every admin page uses (/admin, /admin/careers, /admin/news, /admin/team).
// Sign-in with a two-step code, the access check, the page frame (top bar with "← Admin", the area's tabs, who is
// signed in), and small helpers. Each area page calls TakgioAdmin.start({...}) with its own tabs and screens.
// Adding a new admin area: a new page + script that call start(), and a card for it in js/admin-hub.js.
// One sign-in covers every admin page: Supabase keeps the session in this browser for the whole site.
// Who may do what is enforced by the DATABASE (docs/careers-schema.sql): every admin table needs a two-step-verified
// session and a row in careers_editors (the admin team, despite the name). The pages only show or hide buttons to match.
// Depends on: Supabase JS (CDN), supabase-config.js.
// ============================================================
(function () {
  'use strict';

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(d) {
    if (!d) return '—';
    var s = String(d), p = s.slice(0, 10).split('-');
    return MONTHS[+p[1] - 1] + ' ' + (+p[2]) + ', ' + p[0];
  }
  function toast(msg, isErr) {
    var t = document.createElement('div'); t.className = 'cra-toast' + (isErr ? ' err' : ''); t.textContent = msg;
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, isErr ? 6000 : 2800);
  }
  function opt(v, label, sel) { return '<option value="' + esc(v) + '"' + (v === sel ? ' selected' : '') + '>' + esc(label) + '</option>'; }

  /** opts: { area: 'Careers' | 'News' | 'Team & access' | null (the hub), tabs: [[hash, label, adminOnly]], route: function (view, parts) } */
  function start(opts) {
    var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    var root = document.getElementById('cra-root');
    var A = { sb: sb, state: { user: null, role: null, name: '' }, esc: esc, fmt: fmt, toast: toast, opt: opt, MONTHS: MONTHS };
    A.isAdmin = function () { return A.state.role === 'admin'; };

    // ---------------- sign-in screens ----------------
    function shell(inner) {
      root.innerHTML = '<div class="cra-login"><div style="width:100%;display:grid;gap:22px;justify-items:center">' +
        '<div style="text-align:center"><div class="cra-brand" style="color:#11142a;font-size:1.6rem">Takgio</div><div style="color:var(--color-text-secondary);font-weight:600">Admin' + (opts.area ? ' &middot; ' + esc(opts.area) : '') + '</div></div>' +
        '<div class="cra-lcard" style="max-width:420px;width:100%">' + inner + '</div></div></div>';
    }
    function showLogin(msg) {
      shell('<div class="tag">Step 1 of 2</div><h2>Sign in</h2><p style="margin:0 0 14px;font-size:.9rem">Access is by invitation only.</p>' +
        '<form id="f-login"><div class="cra-f"><label for="e">Email</label><input type="email" id="e" autocomplete="email" required placeholder="you@takgio.com"></div>' +
        '<div class="cra-f"><label for="p">Password</label><input type="password" id="p" autocomplete="current-password" required></div>' +
        '<button class="cra-btn pri" style="width:100%" type="submit">Continue</button><p class="cra-err" id="err">' + esc(msg || '') + '</p></form>' +
        '<p class="cra-hint" style="margin-top:10px"><a href="#" id="forgot">Forgot your password?</a></p>');
      document.getElementById('f-login').addEventListener('submit', function (e) {
        e.preventDefault();
        var err = document.getElementById('err'); err.textContent = '';
        sb.auth.signInWithPassword({ email: document.getElementById('e').value.trim(), password: document.getElementById('p').value }).then(function (r) {
          if (r.error) { err.textContent = r.error.message; return; }
          afterAuth();
        });
      });
      document.getElementById('forgot').addEventListener('click', function (ev) {
        ev.preventDefault();
        var email = document.getElementById('e').value.trim(), err = document.getElementById('err');
        if (!email) { err.textContent = 'Type your email above first.'; return; }
        // No redirectTo: the project's Site URL is /login.html, the only allowed redirect, and that page already handles reset links
        sb.auth.resetPasswordForEmail(email).then(function (r) {
          err.textContent = r.error ? r.error.message : 'If that address has access, a reset link is on its way.';
        });
      });
    }
    function showCode(factorId) {
      shell('<div class="tag">Step 2 of 2</div><h2>Enter your code</h2><p style="margin:0 0 10px;font-size:.9rem">Open your authenticator app and enter the 6-digit code for Takgio.</p>' +
        '<form id="f-code"><div class="cra-f"><input class="cra-code-in" id="c" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" required></div>' +
        '<button class="cra-btn pri" style="width:100%" type="submit">Verify and sign in</button><p class="cra-err" id="err"></p></form>' +
        '<p class="cra-hint"><a href="#" id="out">Use a different account</a></p>');
      document.getElementById('f-code').addEventListener('submit', function (e) {
        e.preventDefault();
        sb.auth.mfa.challengeAndVerify({ factorId: factorId, code: document.getElementById('c').value.trim() }).then(function (r) {
          if (r.error) { document.getElementById('err').textContent = r.error.message; return; }
          afterAuth();
        });
      });
      document.getElementById('out').addEventListener('click', function (ev) { ev.preventDefault(); A.signOut(); });
    }
    function showEnroll() {
      shell('<div class="tag">First sign-in</div><h2>Link your authenticator app</h2><p style="margin:0 0 6px;font-size:.9rem">Scan this code with an authenticator app (Google Authenticator, 1Password, Authy), then enter the 6-digit code it shows.</p><div id="enroll">Preparing…</div>');
      sb.auth.mfa.listFactors().then(function (lf) {
        var stale = ((lf.data && lf.data.all) || []).filter(function (f) { return f.factor_type === 'totp' && f.status === 'unverified'; });
        return Promise.all(stale.map(function (f) { return sb.auth.mfa.unenroll({ factorId: f.id }); }));
      }).then(function () {
        return sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Takgio admin ' + new Date().toISOString().slice(0, 10) });
      }).then(function (r) {
        if (r.error) { document.getElementById('enroll').innerHTML = '<p class="cra-err">' + esc(r.error.message) + '</p>'; return; }
        var d = r.data;
        document.getElementById('enroll').innerHTML = '<img class="cra-qr" alt="QR code for your authenticator app" src="' + esc(d.totp.qr_code) + '">' +
          '<p class="cra-hint">Can’t scan? Enter this key instead:</p><div class="cra-secret">' + esc(d.totp.secret) + '</div>' +
          '<form id="f-enroll" style="margin-top:14px"><div class="cra-f"><input class="cra-code-in" id="c" inputmode="numeric" maxlength="6" placeholder="000000" required></div>' +
          '<button class="cra-btn pri" style="width:100%" type="submit">Link app and sign in</button><p class="cra-err" id="err"></p></form>';
        document.getElementById('f-enroll').addEventListener('submit', function (e) {
          e.preventDefault();
          sb.auth.mfa.challengeAndVerify({ factorId: d.id, code: document.getElementById('c').value.trim() }).then(function (v) {
            if (v.error) { document.getElementById('err').textContent = v.error.message; return; }
            afterAuth();
          });
        });
      });
    }
    // `who` is the signed-in email, `problem` an error from the lookup (a failed lookup must not read as "no access")
    function showNoAccess(who, problem) {
      shell(problem
        ? '<h2>Couldn’t check your access</h2><p style="margin:0 0 10px">' + (who ? 'Signed in as <b>' + esc(who) + '</b>. ' : '') + 'The access check failed, so nothing is shown.</p><p class="cra-err">' + esc(problem) + '</p><button class="cra-btn" id="out">Sign out</button>'
        : '<h2>No admin access yet</h2><p style="margin:0 0 10px">' + (who ? 'You’re signed in as <b>' + esc(who) + '</b>, but that' : 'You’re signed in, but this') + ' account hasn’t been given access to the Takgio admin. If you have another account, sign out and use that one; otherwise ask an admin to add you.</p><button class="cra-btn" id="out">Sign out</button>');
      document.getElementById('out').addEventListener('click', A.signOut);
    }
    A.signOut = function () { sb.auth.signOut().then(function () { A.state = { user: null, role: null, name: '' }; showLogin(); }); };

    function afterAuth() {
      sb.auth.mfa.getAuthenticatorAssuranceLevel().then(function (a) {
        if (a.error) return showLogin(a.error.message);
        if (a.data.currentLevel !== 'aal2') {
          return sb.auth.mfa.listFactors().then(function (f) {
            var ok = ((f.data && f.data.totp) || []).filter(function (x) { return x.status === 'verified'; });
            if (ok.length) showCode(ok[0].id); else showEnroll();
          });
        }
        return sb.auth.getUser().then(function (u) {
          A.state.user = u.data.user;
          return sb.from('careers_editors').select('role,display_name').eq('user_id', A.state.user.id).maybeSingle();
        }).then(function (r) {
          if (r.error) return showNoAccess(A.state.user && A.state.user.email, r.error.message);
          if (!r.data) return showNoAccess(A.state.user && A.state.user.email);
          A.state.role = r.data.role; A.state.name = r.data.display_name || A.state.user.email;
          route();
        });
      });
    }

    // ---------------- page frame + routing ----------------
    function topbar(active) {
      var tabs = (opts.tabs || []).filter(function (t) { return !t[2] || A.isAdmin(); }).map(function (t) {
        return '<a href="#' + t[0] + '" class="' + (t[0] === active ? 'on' : '') + '">' + t[1] + (t[2] ? '<span class="pill">Admin</span>' : '') + '</a>';
      }).join('');
      return '<div class="cra-top"><div class="in"><div class="cra-brand">' + (opts.area ? '<a href="/admin" class="cra-home" title="Back to Admin">&larr; Admin</a>' : '') +
        'Takgio<small>' + esc(opts.area || 'Admin') + '</small></div><nav class="cra-nav">' + tabs + '</nav>' +
        '<div class="cra-user"><span>Signed in as <b>' + esc(A.state.name) + '</b>' + (A.state.user.email && A.state.user.email !== A.state.name ? ', ' + esc(A.state.user.email) : '') + ' &middot; ' + (A.isAdmin() ? 'Admin' : 'Editor') + '</span><a href="#" id="signout">Sign out</a></div></div></div>';
    }
    A.page = function (active, html) {
      root.innerHTML = topbar(active) + '<div class="cra-wrap">' + html + '</div>';
      document.getElementById('signout').addEventListener('click', function (e) { e.preventDefault(); A.signOut(); });
    };
    function route() {
      if (!A.state.role) return;
      var parts = (location.hash || '').slice(1).split('/');
      opts.route(A, parts[0] || '', parts);
    }
    A.route = route;
    window.addEventListener('hashchange', route);

    sb.auth.onAuthStateChange(function (event) {
      if (event !== 'PASSWORD_RECOVERY') return;
      shell('<h2>Set a new password</h2><form id="f-new"><div class="cra-f"><input type="password" id="np" minlength="8" required placeholder="New password (8+ characters)"></div><button class="cra-btn pri" style="width:100%" type="submit">Update password</button><p class="cra-err" id="err"></p></form>');
      document.getElementById('f-new').addEventListener('submit', function (e) { e.preventDefault(); sb.auth.updateUser({ password: document.getElementById('np').value }).then(function (r) { if (r.error) document.getElementById('err').textContent = r.error.message; else afterAuth(); }); });
    });
    sb.auth.getSession().then(function (s) { if (!s.data.session) showLogin(); else afterAuth(); });
    return A;
  }

  window.TakgioAdmin = { start: start, esc: esc, fmt: fmt, opt: opt, MONTHS: MONTHS };
})();
