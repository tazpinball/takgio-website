// ============================================================
// Auth module — Supabase Auth for the project dashboard
// ============================================================
// Depends on: supabase-config.js (loaded first), Supabase JS CDN
// ============================================================

(function () {
  'use strict';

  var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Expose supabase client globally for other modules
  window.sb = sb;

  // --- Login page logic ---
  var loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var email = document.getElementById('login-email').value.trim();
      var password = document.getElementById('login-password').value;
      var errorEl = document.getElementById('login-error');
      var btn = document.getElementById('btn-login');

      errorEl.textContent = '';
      btn.disabled = true;
      btn.textContent = 'Signing in...';

      var result = await sb.auth.signInWithPassword({ email: email, password: password });

      if (result.error) {
        errorEl.textContent = result.error.message;
        btn.disabled = false;
        btn.textContent = 'Sign In';
        return;
      }

      window.location.href = '/dashboard.html';
    });

    // If already logged in, redirect to dashboard
    sb.auth.getSession().then(function (res) {
      if (res.data.session) {
        window.location.href = '/dashboard.html';
      }
    });
  }

  // --- Auth guard for protected pages ---
  window.AuthGuard = {
    // Call this on every protected page. Returns the user or redirects to login.
    require: async function () {
      var res = await sb.auth.getSession();
      if (!res.data.session) {
        window.location.href = '/login.html';
        return null;
      }
      return res.data.session.user;
    },

    // Get current user (non-blocking, returns null if not logged in)
    getUser: async function () {
      var res = await sb.auth.getSession();
      return res.data.session ? res.data.session.user : null;
    },

    // Get display name from user metadata
    getDisplayName: function (user) {
      if (!user) return '';
      var meta = user.user_metadata || {};
      return meta.display_name || meta.full_name || user.email.split('@')[0];
    },

    // Sign out and redirect to login
    logout: async function () {
      await sb.auth.signOut();
      window.location.href = '/login.html';
    }
  };
})();
