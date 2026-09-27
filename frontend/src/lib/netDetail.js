// ── frontend/src/lib/netDetail.js ──────────────────────────────────
// WHAT: ONE voice for every load failure (offline? stale backend? waking
// server? timeout?). Pages pass { status, error } (api() result or caught
// exception) and get back plain human words — same phrasing as Refer & Earn,
// now shared so Dashboard/Chats/Catalog/Insights/Notifications/Admin all
// speak identically. No npm modules — navigator + string checks only.
export function describeLoadFailure({ status, error } = {}) {
  const msg = (error && (error.error || error.message)) || '';
  if (msg) return msg; // backend gave words (validation, paywall…) — trust them first!
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'You look offline — reconnect and retry.'; // airplane mode / dead data (browser KNOWS!)
  if (status === 404) return 'This app copy is newer than the backend — redeploy the backend.';
  if (status === 503) return 'Server is waking up (cold start?) — tap Retry in a few seconds.';
  if (status === 401) return 'Signed out — sign in again.';
  return 'The server did not answer — your data is safe. Check your connection, then tap Retry.';
}

export function describeNetError(e) { // caught exception (fetch threw: abort/offline/DNS — no status exists!)
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'You look offline — reconnect and retry.';
  const name = (e && e.name) || '';
  if (name === 'AbortError') return 'Timed out (15s) — tap Retry.';
  return 'Connection failed — tap Retry.';
}
