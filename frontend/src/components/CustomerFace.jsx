// ── frontend/src/components/CustomerFace.jsx ───────────────────────
// WHAT: a customer's picture. Shows their real photo when the conversation has
// one (customer_photo), and a person-shaped icon otherwise, or if the photo fails
// to load. WhatsApp does not give businesses customer photos, so the icon is the
// normal case there. The phone's copy is CustomerFace in widgets/brand_ui.dart.
import { useState } from 'react';

export default function CustomerFace({ photo }) {
  const [broken, setBroken] = useState(false);
  if (photo && !broken) return <img className="cface-img" src={photo} alt="" onError={() => setBroken(true)} />;
  return (
    <svg className="cface-ic" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="8" r="4.2" />
      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7c0 .6-.4 1-1 1H5c-.6 0-1-.4-1-1z" />
    </svg>
  );
}
