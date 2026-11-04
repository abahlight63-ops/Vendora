// ── src/utils/lagosDay.js ─────────────────────────────────────────
// WHAT: "today" in Lagos time, as SQL fragments. Postgres CURRENT_DATE follows
// the database clock (UTC), so daily limits used to reset at 1 AM in Lagos.
// TODAY_START = the timestamptz of the latest Lagos midnight (compare created_at with it).
// TODAY_DATE  = today's calendar date in Lagos (for DATE columns like ai_usage.day).
const TZ = 'Africa/Lagos';
const TODAY_START = `(date_trunc('day', now() AT TIME ZONE '${TZ}') AT TIME ZONE '${TZ}')`;
const TODAY_DATE = `((now() AT TIME ZONE '${TZ}')::date)`;
module.exports = { TZ, TODAY_START, TODAY_DATE };
