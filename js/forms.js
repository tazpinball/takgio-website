// Every Formspree form on the site sends in the background and says thanks in place, so the visitor
// stays on takgio.com instead of landing on formspree.io/thanks. If fetch fails or the script never
// runs, the form still posts the ordinary way (the old behaviour). Messages follow the form's
// hidden "source" field; the contact form has none and gets its own.
//
// A form with data-kit-form="<Kit form id>" (the Brickture waitlist) is also sent to that Kit form,
// which emails the visitor a link to confirm their address (double opt-in). Formspree still keeps a
// copy. The confirmation link goes to /brickture/welcome (the thank-you page, set in Kit). Older
// confirmation links came back to the Brickture page with ?confirmed=1; those are sent on to it too.
// Since v2.69.0 the signup goes through /api/insider-signup (a Vercel function holding the Kit API key), which
// adds the address to Kit itself and says whether it was new, unconfirmed or already an Insider. That avoids Kit's
// bot check on its public form, which silently dropped some real signups. If the function can't answer, the page
// falls back to posting to Kit's public form as before.
//
// Since v2.70.0 every form also says where the visitor first came from ("came_from"): a ?utm_source= or ?src= on
// the link they arrived by (the tagged links we post on TikTok, YouTube and so on), else the site that sent them
// (document.referrer), else "direct". The first one is remembered for 30 days in this browser, so a visitor who
// arrives from TikTok and signs up two pages later still counts as TikTok. Brickture signups store it in Kit's
// "Signup source" field; every Formspree submission carries it too.
(() => {
  const SRC_KEY = 'takgio.came_from';
  const SRC_DAYS = 30;
  const clean = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 30);
  const fromReferrer = (ref) => {
    let host = '';
    try { host = new URL(ref).hostname.toLowerCase().replace(/^(www|m|l|lm|mobile)\./, ''); } catch (e) { return ''; }
    if (!host || /(^|\.)takgio\.com$/.test(host)) return ''; // our own pages are not a source
    const known = [
      [/(^|\.)tiktok\.com$/, 'tiktok'], [/^(t\.co|x\.com|twitter\.com)$/, 'x'],
      [/(^|\.)(youtube\.com|youtu\.be)$/, 'youtube'], [/(^|\.)reddit\.com$/, 'reddit'],
      [/(^|\.)(facebook\.com|fb\.com|messenger\.com)$/, 'facebook'], [/(^|\.)instagram\.com$/, 'instagram'],
      [/(^|\.)threads\.net$/, 'threads'], [/(^|\.)pinterest\./, 'pinterest'], [/(^|\.)linkedin\.com$/, 'linkedin'],
      [/(^|\.)google\./, 'google'], [/(^|\.)bing\.com$/, 'bing'], [/(^|\.)duckduckgo\.com$/, 'duckduckgo'],
      [/(^|\.)(kit\.com|ck\.page|convertkit\.com|kit-mail\d*\.com)$/, 'email'], [/^mail\./, 'email'],
    ];
    for (const [re, name] of known) if (re.test(host)) return name;
    return clean(host);
  };
  const cameFrom = (() => {
    const q = new URLSearchParams(location.search);
    const now = clean(q.get('utm_source') || q.get('src')) || fromReferrer(document.referrer);
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(SRC_KEY) || 'null'); } catch (e) { saved = null; }
    if (saved && saved.s && Date.now() - saved.t < SRC_DAYS * 864e5) return saved.s; // first touch wins
    const s = now || 'direct';
    if (now) { try { localStorage.setItem(SRC_KEY, JSON.stringify({ s, t: Date.now() })); } catch (e) { /* private mode */ } }
    return s;
  })();

  const DONE = {
    'brickture-waitlist': "You’re on the list. We’ll send you Insider news as Brickture gets closer to launch.",
    'concreteiq-beta': "Thanks. We’ll be in touch about ConcreteIQ beta access.",
    newsletter: "You’re subscribed. Thanks for staying in the loop.",
  };
  const CHECK_INBOX = 'Almost there! Check your inbox and click the link to confirm you’re a Brickture Insider.';
  // When our function can't answer, the line covers both cases: Kit sends no second email to someone
  // already on the list, and its own reply does not say which case it was.
  const CHECK_INBOX_OR_ALREADY = CHECK_INBOX + ' Already an Insider? You’re all set; there’s no need to sign up again.';
  const ALREADY = 'You’re already a Brickture Insider, so you’re all set. Watch your inbox for launch news.';
  const PENDING = 'You’ve already signed up but haven’t confirmed yet. Check your inbox (and spam folder) for “Confirm you’re a Brickture Insider” and click the button inside.';
  // The Takgio News form in Kit (v2.73.0; id 10165648, the footer box on every page): the same confirm-by-email flow.
  const NEWS_FORM = '10165648';
  const NEWS = {
    sent: 'Almost there! Check your inbox and click the link to confirm your subscription to Takgio News.',
    sentOrAlready: 'Almost there! Check your inbox and click the link to confirm your subscription to Takgio News. Already subscribed? You’re all set.',
    already: 'You’re already subscribed to Takgio News, so you’re all set.',
    added: 'You’re subscribed to Takgio News. Watch your inbox for company news.',
    pending: 'You’ve already signed up but haven’t confirmed yet. Check your inbox (and spam folder) for “Confirm your subscription to Takgio News” and click the button inside.',
  };
  const FAIL = 'Something went wrong. Please try again, or email info@takgio.com.';

  const say = (form, text, focus, link) => {
    const done = document.createElement('p');
    done.className = 'form-done';
    done.setAttribute('role', 'status');
    done.tabIndex = -1;
    done.textContent = text; // textContent: anything a visitor typed is never read as HTML
    if (link) {
      const a = document.createElement('a');
      a.href = link.href;
      a.textContent = link.text;
      done.append(' ', a);
    }
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

  // Sign up through our function: 'already' | 'pending' | 'sent', or null when it can't answer
  // (not set up, slow, offline), in which case the caller falls back to Kit's public form.
  const insiderSignup = async (email, source, list) => {
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 8000);
      const res = await fetch('/api/insider-signup', {
        method: 'POST', signal: ctl.signal,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email, source, list }),
      });
      clearTimeout(timer);
      if (!res.ok) return null;
      const { result } = await res.json();
      return ['already', 'pending', 'sent', 'added'].includes(result) ? result : null;
    } catch (err) { return null; }
  };

  // Back from an older confirmation link (brickture.html?confirmed=1): on to the thank-you page.
  if (/[?&]confirmed=1(&|$)/.test(location.search) && document.querySelector('form[data-kit-form="10153875"]')) {
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
      data.set('came_from', cameFrom);
      const kitId = form.getAttribute('data-kit-form');
      const email = String(data.get('email') || '').trim();
      const human = kitId && !data.get('_gotcha');
      const isNews = kitId === NEWS_FORM;
      const result = human ? await insiderSignup(email, cameFrom, isNews ? 'news' : 'insiders') : null;
      if (result === 'already') {
        if (isNews) say(form, NEWS.already, true, { href: '/news.html', text: 'Read the latest news →' });
        else say(form, ALREADY, true, { href: '/brickture/insiders', text: 'See the Insider’s view →' });
        return;
      }
      if (result === 'added') { say(form, NEWS.added, true, { href: '/news.html', text: 'Read the latest news →' }); return; }
      if (result === 'pending') { say(form, isNews ? NEWS.pending : PENDING, true); return; }
      const toFormspree = fetch(form.action, { method: 'POST', body: data, headers: { Accept: 'application/json' } })
        .then((res) => { if (!res.ok) throw new Error('HTTP ' + res.status); });
      if (result === 'sent') {
        // In Kit already; Formspree keeps its usual copy, and its answer doesn't change what the visitor sees.
        toFormspree.catch(() => {});
        say(form, isNews ? NEWS.sent : CHECK_INBOX, true);
        return;
      }
      const toKit = human ? sendToKit(kitId, email) : null;
      const [fs, kit] = await Promise.allSettled([toFormspree, toKit || Promise.resolve()]);
      if (kitId && kit.status === 'fulfilled' && toKit) {
        // Kit's bot check: it answers "quarantined" with a page where the visitor proves they are a person,
        // and nothing is sent until they do. Send them there rather than saying an email is on its way.
        const k = kit.value || {};
        if (k.status === 'quarantined' && /^https:\/\/app\.kit\.com\//.test(k.url || '')) { location.href = k.url; return; }
        say(form, isNews ? NEWS.sentOrAlready : CHECK_INBOX_OR_ALREADY, true);
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
