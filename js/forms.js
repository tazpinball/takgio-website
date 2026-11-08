// Every Formspree form on the site sends in the background and says thanks in place, so the visitor
// stays on takgio.com instead of landing on formspree.io/thanks. If fetch fails or the script never
// runs, the form still posts the ordinary way (the old behaviour). Messages follow the form's
// hidden "source" field; the contact form has none and gets its own.
//
// A form with data-kit-form="<Kit form id>" (the Brickture waitlist) is also sent to that Kit form,
// which emails the visitor a link to confirm their address (double opt-in). Formspree still keeps a
// copy. The confirmation link goes to /brickture/welcome (the thank-you page, set in Kit). Older
// confirmation links came back to the Brickture page with ?confirmed=1; those are sent on to it too.
(() => {
  const DONE = {
    'brickture-waitlist': "You’re on the list. We’ll send you Insider news as Brickture gets closer to launch.",
    'concreteiq-beta': "Thanks. We’ll be in touch about ConcreteIQ beta access.",
    newsletter: "You’re subscribed. Thanks for staying in the loop.",
  };
  // Kit sends no second confirmation or welcome to someone already on the list, and its reply does not say which
  // case it was, so the line covers both.
  const CHECK_INBOX = 'Almost there! Check your inbox and click the link to confirm you’re a Brickture Insider. Already an Insider? You’re all set; there’s no need to sign up again.';
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
    }).then((res) => {
      if (!res.ok) throw new Error('Kit HTTP ' + res.status);
      return res.json().catch(() => ({}));
    });
  };

  // Back from an older confirmation link (brickture.html?confirmed=1): on to the thank-you page.
  if (/[?&]confirmed=1(&|$)/.test(location.search) && document.querySelector('form[data-kit-form]')) {
    location.replace('/brickture/welcome');
    return;
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
      if (kitId && kit.status === 'fulfilled' && toKit) {
        // Kit's bot check: it answers "quarantined" with a page where the visitor proves they are a person,
        // and nothing is sent until they do. Send them there rather than saying an email is on its way.
        const k = kit.value || {};
        if (k.status === 'quarantined' && /^https:\/\/app\.kit\.com\//.test(k.url || '')) { location.href = k.url; return; }
        say(form, CHECK_INBOX, true);
        return;
      }
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
