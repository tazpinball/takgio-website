// GET /api/signups  (header: Authorization: Bearer <Supabase access token>)  ->  every signup list in one answer.
// Feeds the private page /admin/signups (v2.74.0). It returns people's email addresses and messages, so it answers
// ONLY a caller who is, in Supabase: signed in with a valid session, two-step verified (aal2), and an ADMIN in
// careers_editors (the admin team table). Anything else gets 401/403 and no data. Nothing is written anywhere.
//   Kit:       the Brickture waitlist form (Insiders) and the Takgio News form: confirmed + unconfirmed people, each
//              with the date and where they signed up from. Needs KIT_API_KEY (already set in Vercel).
//   Formspree: the site's one form: contact messages, ConcreteIQ beta requests, and the backup copy of newsletter
//              and Brickture signups. Needs FORMSPREE_API_KEY in Vercel (a read-only or master key); without it
//              this part says "not connected" and the Kit part still works.
const SUPABASE_URL = 'https://pwmrbmjlgweahridxvgk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_hl85SOTn2XIl2eV5noeZww_CDKjaLVT'; // public by design (js/supabase-config.js)
const KIT_FORMS = [
  { id: 10153875, key: 'insiders', name: 'Brickture Insiders' },
  { id: 10165648, key: 'news', name: 'Takgio News' },
];
const FORMSPREE_FORM = 'mreokggq';
// Ted's own test addresses: flagged so the page can hide them
const TEST_RE = /ted\.takvorian|ted@takgio|tazpinball|info@takgio|ipadheadphones/i;

const j = (res, code, body) => { res.status(code).json(body); };

// who is calling? null unless a valid, two-step-verified admin session
async function admin(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!m) return { code: 401, error: 'sign in first' };
  const token = m[1];
  const u = await fetch(SUPABASE_URL + '/auth/v1/user', { headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token } });
  if (!u.ok) return { code: 401, error: 'session not valid' };
  const user = await u.json();
  let aal = '';
  try { aal = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')).aal; } catch (e) { /* stays empty */ }
  if (aal !== 'aal2') return { code: 403, error: 'two-step sign-in required' };
  const r = await fetch(SUPABASE_URL + '/rest/v1/careers_editors?select=role&user_id=eq.' + encodeURIComponent(user.id),
    { headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token } }); // the database applies its own access rules to this
  if (!r.ok) return { code: 403, error: 'access check failed' };
  const rows = await r.json();
  if (!rows.length || rows[0].role !== 'admin') return { code: 403, error: 'admins only' };
  return { user };
}

const kit = (key, path) => fetch('https://api.kit.com/v4' + path, { headers: { 'X-Kit-Api-Key': key, Accept: 'application/json' } });

async function kitList(key, formId, status) {
  const out = [];
  let after = '';
  for (let page = 0; page < 10; page++) {
    const r = await kit(key, '/forms/' + formId + '/subscribers?status=' + status + '&per_page=1000' + (after ? '&after=' + encodeURIComponent(after) : ''));
    if (!r.ok) throw new Error('kit ' + r.status);
    const d = await r.json();
    for (const s of d.subscribers || []) {
      out.push({ email: s.email_address, joined: s.added_at || s.created_at, source: (s.fields && s.fields.signup_source) || null, test: TEST_RE.test(s.email_address || '') });
    }
    if (!d.pagination || !d.pagination.has_next_page) break;
    after = d.pagination.end_cursor;
  }
  return out;
}

async function formspree(key) {
  const url = 'https://formspree.io/api/0/forms/' + FORMSPREE_FORM + '/submissions?limit=500';
  let r = await fetch(url, { headers: { Authorization: 'Basic ' + Buffer.from(':' + key).toString('base64') } });
  if (r.status === 401 || r.status === 403) r = await fetch(url, { headers: { Authorization: 'Bearer ' + key } });
  if (!r.ok) throw new Error('formspree ' + r.status);
  const d = await r.json();
  return (d.submissions || []).map((s) => {
    const o = { joined: s._date || s.submitted_at || null, test: TEST_RE.test(String(s.email || '')) };
    for (const k of Object.keys(s)) {
      if (k.startsWith('_') || k === 'submitted_at' || k === 'id') continue;
      if (typeof s[k] === 'string') o[k] = s[k].slice(0, 1500);
    }
    return o;
  });
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return j(res, 405, { error: 'GET only' }); }
  let who;
  try { who = await admin(req); } catch (e) { return j(res, 502, { error: 'sign-in service unreachable' }); }
  if (who.error) return j(res, who.code, { error: who.error });

  const out = { kit: [], formspree: null, notes: [], asOf: new Date().toISOString() };
  const kitKey = process.env.KIT_API_KEY;
  if (!kitKey) out.notes.push('Kit is not connected (KIT_API_KEY is missing in Vercel).');
  else {
    for (const f of KIT_FORMS) {
      try {
        const [active, inactive] = await Promise.all([kitList(kitKey, f.id, 'active'), kitList(kitKey, f.id, 'inactive')]);
        out.kit.push({ key: f.key, name: f.name, active, inactive });
      } catch (e) { out.kit.push({ key: f.key, name: f.name, error: 'Kit did not answer (' + e.message + ')' }); }
    }
  }
  const fsKey = process.env.FORMSPREE_API_KEY;
  if (!fsKey) out.notes.push('Formspree is not connected yet: contact messages and ConcreteIQ requests will show here once FORMSPREE_API_KEY is added in Vercel.');
  else {
    try { out.formspree = await formspree(fsKey); } catch (e) { out.notes.push('Formspree did not answer (' + e.message + ').'); }
  }
  return j(res, 200, out);
};
