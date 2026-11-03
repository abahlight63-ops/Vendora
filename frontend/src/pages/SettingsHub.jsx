// ── frontend/src/pages/SettingsHub.jsx ─────────────────────────────
// WHAT: one Settings page with three tabs, replacing three separate pages:
// Your shop (was Business), Velo's voice (was AI settings) and Account (was
// Settings). Every tab shows the same full content on a phone and a desktop.
// The tab lives in the address (?tab=shop|voice|account), so old links and the
// Help Center guides can open the right one.
import { useSearchParams } from 'react-router-dom';
import Profile from './Profile.jsx';
import AiSettings from './AiSettings.jsx';
import Settings from './Settings.jsx';

const TABS = [
  ['shop', 'Your shop', 'Shop', 'M4 10v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9M3 6.5 4.6 4h14.8L21 6.5a2.5 2.5 0 0 1-4.5 1.5A2.5 2.5 0 0 1 12 9.5 2.5 2.5 0 0 1 7.5 8 2.5 2.5 0 0 1 3 6.5zM9 20v-5h6v5'],
  ['voice', "Velo's voice", 'Velo', 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z'],
  ['account', 'Account', 'Account', 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0'],
];

export default function SettingsHub({ biz, setMe }) {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t[0] === params.get('tab')) ? params.get('tab') : 'shop';
  return (
    <div className="sh">
      <div className="sh-head">
        <div>
          <div className="dg-status on"><i />{biz?.name || 'Your shop'}</div>
          <h1>Settings</h1>
          <p>Your shop, how Velo talks, and your account, in one place.</p>
        </div>
        <div className="sh-tabs" role="tablist" aria-label="Settings sections">
          {TABS.map(([k, long, short, d]) => (
            <button key={k} type="button" role="tab" data-tab={k} aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setParams({ tab: k }, { replace: true })}>
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d={d} /></svg>
              <span className="sh-long">{long}</span><span className="sh-short">{short}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="sh-body" role="tabpanel">
        {tab === 'shop' && <Profile biz={biz} embedded />}
        {tab === 'voice' && <AiSettings biz={biz} embedded />}
        {tab === 'account' && <Settings biz={biz} setMe={setMe} embedded />}
      </div>
    </div>
  );
}
