// Every Formspree form on the site sends in the background and says thanks in place, so the visitor
// stays on takgio.com instead of landing on formspree.io/thanks. If fetch fails or the script never
// runs, the form still posts the ordinary way (the old behaviour). Messages follow the form's
// hidden "source" field; the contact form has none and gets its own.
(() => {
  const DONE = {
    'brickture-waitlist': "You’re on the list. We’ll email you when Brickture launches.",
    'concreteiq-beta': "Thanks. We’ll be in touch about ConcreteIQ beta access.",
    newsletter: "You’re subscribed. Thanks for staying in the loop.",
  };
  const FAIL = 'Something went wrong. Please try again, or email info@takgio.com.';

  document.querySelectorAll('form[action*="formspree.io/f/"]').forEach((form) => {
    form.addEventListener('submit', async (e) => {
      if (!window.fetch || !window.FormData) return; // very old browser: let it post normally
      e.preventDefault();
      const btn = form.querySelector('[type="submit"]');
      const old = form.querySelector('.form-error');
      if (old) old.remove();
      if (btn) { btn.disabled = true; btn.setAttribute('aria-busy', 'true'); }
      try {
        const res = await fetch(form.action, {
          method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' },
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const source = (form.querySelector('input[name="source"]') || {}).value;
        let text = DONE[source];
        if (!text) {
          const name = ((form.querySelector('input[name="name"]') || {}).value || '').trim().split(/\s+/)[0];
          text = (name ? 'Thanks, ' + name + '. ' : 'Thanks. ') +
            'We got your message and will get back to you within one business day.';
        }
        const done = document.createElement('p');
        done.className = 'form-done';
        done.setAttribute('role', 'status');
        done.tabIndex = -1;
        done.textContent = text; // textContent: the visitor's name is never read as HTML
        form.replaceChildren(done);
        form.classList.add('is-sent');
        done.focus({ preventScroll: true });
      } catch (err) {
        const msg = document.createElement('p');
        msg.className = 'form-error';
        msg.setAttribute('role', 'alert');
        msg.textContent = FAIL;
        form.appendChild(msg);
        if (btn) { btn.disabled = false; btn.removeAttribute('aria-busy'); }
      }
    });
  });
})();
