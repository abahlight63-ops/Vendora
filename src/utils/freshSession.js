// ── src/utils/freshSession.js ──────────────────────────────────────
// Session fixation guard: every sign-in gets a brand-new session id. If anyone
// planted or saw the cookie from before sign-in, it stops working the moment
// the owner (or admin) logs in. `keep` copies chosen fields across (the admin
// login keeps the owner's own login underneath). Returns a promise.
function freshSession(req, fields, keep = []) {
  const carry = {};
  for (const k of keep) if (req.session && req.session[k] !== undefined) carry[k] = req.session[k];
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      Object.assign(req.session, carry, fields);
      req.session.save((e) => (e ? reject(e) : resolve()));
    });
  });
}

module.exports = { freshSession };
