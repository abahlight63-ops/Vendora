// ── frontend/src/components/LoadFailed.jsx ─────────────────────────
// WHAT: the ONE load-failure card (brand mark + plain cause + Retry button
// with attempt count + back link). Replaces eternal skeletons on Dashboard,
// Chats, Catalog, Insights, Notifications, Admin panels — same face as
// Refer & Earn's pattern, now shared so the voice never drifts.
// Props: title, status, detail, tries, onRetry, backTo (route) + backLabel.
// No backend calls — pure presentational (parents own the refetch!).
import { Link } from 'react-router-dom'; // back link (client-side nav!)
import Loader from './Loader.jsx'; // mini orbit mark (the brand, even in failure!)

export default function LoadFailed({ title, status, detail, tries = 0, onRetry, backTo = '/dashboard', backLabel = 'Back to Dashboard' }) {
  return (
    <div className="card">
      <div className="empty">
        <Loader size={34} />
        <b>{title || "Couldn't load"}{status ? ` (${status})` : ''}</b>
        {detail || "The server didn't answer. Check your connection, then try again — your data is safe."}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button className="btn sm" onClick={onRetry}>Retry{tries > 0 ? ` (${tries})` : ''}</button>
        <Link className="btn sm ghost" to={backTo}>{backLabel}</Link>
      </div>
    </div>
  );
}
