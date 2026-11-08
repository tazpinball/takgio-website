// POST /api/insider-signup  {"email": "..."}  ->  {"result": "already" | "pending" | "sent"}
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
const FORM_ID = 10153875; // Kit form "Brickture waitlist"

const kit = (key, path, init = {}) => fetch('https://api.kit.com/v4' + path, {
  ...init,
  headers: { 'X-Kit-Api-Key': key, Accept: 'application/json', 'Content-Type': 'application/json' },
});

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); res.status(405).json({ error: 'POST only' }); return; }
  const key = process.env.KIT_API_KEY;
  if (!key) { res.status(503).json({ error: 'not configured' }); return; }

  let body = req.body || {};
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  if (body._gotcha) { res.status(200).json({ result: 'sent' }); return; } // honeypot filled: a bot; add nothing
  const email = String(body.email || '').trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { res.status(400).json({ error: 'bad email' }); return; }

  try {
    const look = await kit(key, '/subscribers?status=all&email_address=' + encodeURIComponent(email));
    if (!look.ok) { res.status(502).json({ error: 'kit lookup ' + look.status }); return; }
    const found = ((await look.json()).subscribers || [])
      .find((s) => String(s.email_address || '').toLowerCase() === email);
    if (found && found.state === 'active') { res.status(200).json({ result: 'already' }); return; }
    // Unconfirmed subscribers do not show in that search (checked 8 Nov), and the form's list ignores an email
    // filter, so read the form's unconfirmed list (small: only people who have not clicked the link yet).
    let after = '';
    for (let page = 0; page < 10; page++) {
      const r = await kit(key, '/forms/' + FORM_ID + '/subscribers?status=inactive&per_page=1000' + (after ? '&after=' + encodeURIComponent(after) : ''));
      if (!r.ok) break;
      const d = await r.json();
      if ((d.subscribers || []).some((s) => String(s.email_address || '').toLowerCase() === email)) {
        res.status(200).json({ result: 'pending' }); return;
      }
      if (!d.pagination || !d.pagination.has_next_page) break;
      after = d.pagination.end_cursor;
    }

    if (!found) {
      const made = await kit(key, '/subscribers', { method: 'POST', body: JSON.stringify({ email_address: email, state: 'inactive' }) });
      if (!made.ok) { res.status(502).json({ error: 'kit create ' + made.status }); return; }
    }
    const added = await kit(key, '/forms/' + FORM_ID + '/subscribers', { method: 'POST', body: JSON.stringify({ email_address: email }) });
    if (!added.ok) { res.status(502).json({ error: 'kit form ' + added.status }); return; }
    res.status(200).json({ result: 'sent' });
  } catch (e) {
    res.status(502).json({ error: 'kit unreachable' });
  }
};
