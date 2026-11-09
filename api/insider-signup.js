// POST /api/insider-signup  {"email": "...", "source": "tiktok", "list": "news"}  ->  {"result": "already" | "pending" | "sent" | "added"}
// "list" is "insiders" (default, the Brickture waitlist form) or "news" (the Takgio News form, v2.73.0). For "news",
// someone already confirmed in Kit (a Brickture Insider) but not on the news form is just added to it ("added"; Kit
// sends no second confirmation to an address it has already confirmed).
//
// Signs someone up for the Brickture Insiders (Kit form "Brickture waitlist") through the Kit V4 API.
// It replaced the browser posting to Kit's public form endpoint (v2.69.0): that endpoint puts some real
// people behind a bot check ("quarantined"; seen with a VPN on 8 Nov) and the signup silently never reached
// Kit. Through the API there is no bot check, and every signup lands in Kit.
//   already  confirmed Insider; nothing is sent
//   pending  signed up, has not confirmed yet; Kit does not send the confirmation email twice
//   sent     new (or previously unsubscribed): created unconfirmed and added to the double opt-in form,
//            which makes Kit send the "Confirm you're a Brickture Insider" email
// The Kit V4 API key lives in the Vercel environment variable KIT_API_KEY, never in the repo. Without it,
// or if Kit fails, this answers 503/502 and the page falls back to posting to Kit's public form.
// "source" (v2.70.0) is where the visitor first came from (js/forms.js); a new subscriber gets it in Kit's custom
// field "Signup source" (key signup_source), so signups can be counted by channel.
const FORM_ID = 10153875; // Kit form "Brickture waitlist"
const NEWS_FORM_ID = 10165648; // Kit form "Takgio News" (v2.73.0): company news from /news; same confirm-by-email flow

const kit = (key, path, init = {}) => fetch('https://api.kit.com/v4' + path, {
  ...init,
  headers: { 'X-Kit-Api-Key': key, Accept: 'application/json', 'Content-Type': 'application/json' },
});

// Is this address on the form's list with that state? Reads the form's own list: Kit's subscriber search does not
// return unconfirmed people and the form list ignores an email filter (checked 8 Nov). The lists are small.
const formId_ = (list) => (list === 'news' ? NEWS_FORM_ID : FORM_ID);
async function onFormList(key, status, email, list) {
  let after = '';
  for (let page = 0; page < 10; page++) {
    const r = await kit(key, '/forms/' + formId_(list) + '/subscribers?status=' + status + '&per_page=1000' + (after ? '&after=' + encodeURIComponent(after) : ''));
    if (!r.ok) return false;
    const d = await r.json();
    if ((d.subscribers || []).some((x) => String(x.email_address || '').toLowerCase() === email)) return true;
    if (!d.pagination || !d.pagination.has_next_page) return false;
    after = d.pagination.end_cursor;
  }
  return false;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); res.status(405).json({ error: 'POST only' }); return; }
  const key = process.env.KIT_API_KEY;
  if (!key) { res.status(503).json({ error: 'not configured' }); return; }

  let body = req.body || {};
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  if (body._gotcha) { res.status(200).json({ result: 'sent' }); return; } // honeypot filled: a bot; add nothing
  const list = body.list === 'news' ? 'news' : 'insiders';
  const formId = list === 'news' ? NEWS_FORM_ID : FORM_ID;
  const email = String(body.email || '').trim().toLowerCase();
  const source = String(body.source || '').toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 30);
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { res.status(400).json({ error: 'bad email' }); return; }

  try {
    const look = await kit(key, '/subscribers?status=all&email_address=' + encodeURIComponent(email));
    if (!look.ok) { res.status(502).json({ error: 'kit lookup ' + look.status }); return; }
    const found = ((await look.json()).subscribers || [])
      .find((s) => String(s.email_address || '').toLowerCase() === email);
    if (found && found.state === 'active') {
      if (list !== 'news') { res.status(200).json({ result: 'already' }); return; }
      // Confirmed in Kit already (maybe only as a Brickture Insider): on the news form or not?
      if (await onFormList(key, 'active', email, list)) { res.status(200).json({ result: 'already' }); return; }
      const joined = await kit(key, '/forms/' + formId + '/subscribers', { method: 'POST', body: JSON.stringify({ email_address: email }) });
      if (!joined.ok) { res.status(502).json({ error: 'kit form ' + joined.status }); return; }
      res.status(200).json({ result: 'added' }); return;
    }
    // Unconfirmed subscribers do not show in that search (checked 8 Nov), and the form's list ignores an email
    // filter, so read the form's unconfirmed list (small: only people who have not clicked the link yet).
    if (await onFormList(key, 'inactive', email, list)) { res.status(200).json({ result: 'pending' }); return; }

    if (!found) {
      const made = await kit(key, '/subscribers', { method: 'POST', body: JSON.stringify({ email_address: email, state: 'inactive', fields: { signup_source: source || 'unknown' } }) });
      if (!made.ok) { res.status(502).json({ error: 'kit create ' + made.status }); return; }
    }
    const added = await kit(key, '/forms/' + formId + '/subscribers', { method: 'POST', body: JSON.stringify({ email_address: email }) });
    if (!added.ok) { res.status(502).json({ error: 'kit form ' + added.status }); return; }
    res.status(200).json({ result: 'sent' });
  } catch (e) {
    res.status(502).json({ error: 'kit unreachable' });
  }
};
