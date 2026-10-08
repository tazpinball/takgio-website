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
    // A recovery link signs the person in, so the "already logged in, go to the
    // dashboard" redirect below would otherwise win and the reset form would never
    // be usable. Read the link's marker now, before the client clears the URL hash.
    // ?reset=1 lets someone who is already signed in reach the same form.
    var recoveryMode = /[#&?]type=recovery(&|$)/.test(window.location.hash) ||
                       /[?&]type=recovery(&|$)/.test(window.location.search);
    var resetRequested = /[?&]reset=1(&|$)/.test(window.location.search);

    function showResetForm() {
      recoveryMode = true;
      loginForm.style.display = 'none';
      var form = document.getElementById('reset-form');
      if (form) {
        form.style.display = '';
        document.querySelector('.login-subtitle').textContent = 'Reset Password';
      }
    }

    // Listen for auth state changes (handles recovery token from email link)
    sb.auth.onAuthStateChange(function (event, session) {
      if (event === 'PASSWORD_RECOVERY') {
        showResetForm();
      }
    });

    // Password reset form
    var resetForm = document.getElementById('reset-form');
    if (resetForm) {
      resetForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        var password = document.getElementById('reset-password').value;
        var confirm = document.getElementById('reset-confirm').value;
        var errorEl = document.getElementById('reset-error');
        var btn = document.getElementById('btn-reset');

        errorEl.textContent = '';
        if (password !== confirm) {
          errorEl.textContent = 'Passwords do not match.';
          return;
        }

        btn.disabled = true;
        btn.textContent = 'Updating...';

        var result = await sb.auth.updateUser({ password: password });
        if (result.error) {
          errorEl.textContent = result.error.message;
          btn.disabled = false;
          btn.textContent = 'Update Password';
          return;
        }

        window.location.href = '/dashboard.html';
      });
    }

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

    // If already logged in, redirect to dashboard (not while setting a password)
    sb.auth.getSession().then(function (res) {
      if (!res.data.session) return;
      if (resetRequested) { showResetForm(); return; }
      if (recoveryMode) return;
      window.location.href = '/dashboard.html';
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
