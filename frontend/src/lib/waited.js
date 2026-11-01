// ── frontend/src/lib/waited.js ─────────────────────────────────────
// How long a chat has been waiting, in words. The phone's copy is in format.dart.
function minutesSince(stamp) {
  const t = new Date(stamp).getTime();
  return Number.isNaN(t) ? null : Math.max(1, Math.floor((Date.now() - t) / 60000));
}

export function waitedShort(stamp) { // "12m", "3h" or "2d"
  const m = minutesSince(stamp);
  if (m === null) return '';
  if (m < 60) return m + 'm';
  const h = Math.floor(m / 60);
  return h < 24 ? h + 'h' : Math.floor(h / 24) + 'd';
}

export function waitedLong(stamp) { // "12 minutes", "3 hours" or "2 days"
  const m = minutesSince(stamp);
  if (m === null) return '';
  if (m < 60) return m + (m === 1 ? ' minute' : ' minutes');
  const h = Math.floor(m / 60);
  if (h < 24) return h + (h === 1 ? ' hour' : ' hours');
  const d = Math.floor(h / 24);
  return d + (d === 1 ? ' day' : ' days');
}
