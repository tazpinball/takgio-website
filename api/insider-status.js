// POST /api/insider-status  {"email": "..."}  ->  {"state": "active" | "pending" | "new"}
//
// Tells the Brickture signup form whether an address is already on the list, so it can say
// "You're already an Insider" instead of "Check your inbox" (Kit sends nothing to someone already
// confirmed, and its public form endpoint does not say which case it was).
//   active   confirmed subscriber
//   pending  signed up, has not clicked the confirmation link yet (Kit's state "inactive")
//   new      not in Kit, or unsubscribed / bounced (the form treats these as a fresh signup)
// The Kit V4 API key lives in the Vercel environment variable KIT_API_KEY, never in the repo.
// Without it this answers 503 and the form falls back to its general message.
// The account has one list today (the Brickture waitlist), so any subscriber in it is an Insider.
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); res.status(405).json({ error: 'POST only' }); return; }
  const key = process.env.KIT_API_KEY;
  if (!key) { res.status(503).json({ error: 'not configured' }); return; }

  let body = req.body || {};
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const email = String(body.email || '').trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { res.status(400).json({ error: 'bad email' }); return; }

  try {
    const r = await fetch('https://api.kit.com/v4/subscribers?status=all&email_address=' + encodeURIComponent(email), {
      headers: { 'X-Kit-Api-Key': key, Accept: 'application/json' },
    });
    if (!r.ok) { res.status(502).json({ error: 'kit ' + r.status }); return; }
    const data = await r.json();
    const sub = (data.subscribers || []).find((s) => String(s.email_address || '').toLowerCase() === email);
    const state = !sub ? 'new' : sub.state === 'active' ? 'active' : sub.state === 'inactive' ? 'pending' : 'new';
    res.status(200).json({ state });
  } catch (e) {
    res.status(502).json({ error: 'kit unreachable' });
  }
};
