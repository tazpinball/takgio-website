// Every Formspree form on the site sends in the background and says thanks in place, so the visitor
// stays on takgio.com instead of landing on formspree.io/thanks. If fetch fails or the script never
// runs, the form still posts the ordinary way (the old behaviour). Messages follow the form's
// hidden "source" field; the contact form has none and gets its own.
//
// A form with data-kit-form="<Kit form id>" (the Brickture waitlist) is also sent to that Kit form,
// which emails the visitor a link to confirm their address (double opt-in). Formspree still keeps a
// copy. The confirmation link brings them back to the page with ?confirmed=1, where the form is
// replaced by a welcome line.
(() => {
  const DONE = {
    'brickture-waitlist': "You’re on the list. We’ll be in touch as Brickture gets closer to launch.",
    'concreteiq-beta': "Thanks. We’ll be in touch about ConcreteIQ beta access.",
    newsletter: "You’re subscribed. Thanks for staying in the loop.",
  };
  const CHECK_INBOX = 'Almost there! Check your inbox and click the link to confirm your email.';
  const CONFIRMED = "You’re confirmed. Welcome to the Brickture list! We’ll send you updates as launch gets closer.";
  const FAIL = 'Something went wrong. Please try again, or email info@takgio.com.';

  const say = (form, text, focus) => {
    const done = document.createElement('p');
    done.className = 'form-done';
    done.setAttribute('role', 'status');
    done.tabIndex = -1;
    done.textContent = text; // textContent: anything a visitor typed is never read as HTML
    form.replaceChildren(done);
    form.classList.add('is-sent');
    if (focus) done.focus({ preventScroll: true });
    return done;
  };

  const sendToKit = (formId, email) => {
    const body = new FormData();
    body.append('email_address', email);
    return fetch('https://app.kit.com/forms/' + encodeURIComponent(formId) + '/subscriptions', {
      method: 'POST', body, headers: { Accept: 'application/json' },
    }).then((res) => { if (!res.ok) throw new Error('Kit HTTP ' + res.status); });
  };

  // Back from the confirmation email: show the welcome where the form was.
  if (/[?&]confirmed=1(&|$)/.test(location.search)) {
    const form = document.querySelector('form[data-kit-form]');
    if (form) {
      const line = say(form, CONFIRMED, true);
      line.scrollIntoView({ block: 'center' });
    }
  }

  document.querySelectorAll('form[action*="formspree.io/f/"]').forEach((form) => {
    form.addEventListener('submit', async (e) => {
      if (!window.fetch || !window.FormData) return; // very old browser: let it post normally
      e.preventDefault();
      const btn = form.querySelector('[type="submit"]');
      const old = form.querySelector('.form-error');
      if (old) old.remove();
      if (btn) { btn.disabled = true; btn.setAttribute('aria-busy', 'true'); }
      const data = new FormData(form);
      const kitId = form.getAttribute('data-kit-form');
      const toFormspree = fetch(form.action, { method: 'POST', body: data, headers: { Accept: 'application/json' } })
        .then((res) => { if (!res.ok) throw new Error('HTTP ' + res.status); });
      const toKit = kitId && !data.get('_gotcha') ? sendToKit(kitId, String(data.get('email') || '')) : null;
      const [fs, kit] = await Promise.allSettled([toFormspree, toKit || Promise.resolve()]);
      if (kitId && kit.status === 'fulfilled' && toKit) { say(form, CHECK_INBOX, true); return; }
      if (fs.status === 'fulfilled') {
        const source = data.get('source');
        let text = DONE[source];
        if (!text) {
          const name = String(data.get('name') || '').trim().split(/\s+/)[0];
          text = (name ? 'Thanks, ' + name + '. ' : 'Thanks. ') +
            'We got your message and will get back to you within one business day.';
        }
        say(form, text, true);
        return;
      }
      const msg = document.createElement('p');
      msg.className = 'form-error';
      msg.setAttribute('role', 'alert');
      msg.textContent = FAIL;
      form.appendChild(msg);
      if (btn) { btn.disabled = false; btn.removeAttribute('aria-busy'); }
    });
  });
})();
