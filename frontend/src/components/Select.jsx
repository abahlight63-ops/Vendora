// ── frontend/src/components/Select.jsx ────────────────────────────
// WHAT: the app's dropdown. ONE control, used everywhere a choice has to be
// made (catalog shelf, billing currency, business niche, AI model…), so the
// whole product reads as one hand. A native <select> hands the menu to the
// operating system — grey, boxy, unstyleable, different on every device — which
// is exactly what made the old form rows look dated next to pill buttons.
// WHAT IT DOES: a real button that opens a real card of options, keyboard
// operable end to end (Enter/Space to open, ↑/↓ to move, Enter to pick, Esc to
// close), closing on an outside click. No dependencies — just state + refs.
// USAGE:
//   <Select value={cat} onChange={setCat} options={shelves} placeholder="Pick a shelf" />
//   options may be strings (value === label) or { value, label, hint, group }.
import { useEffect, useId, useRef, useState } from 'react'; // useId = a11y link between button and listbox; useRef = outside-click; useState = open + which row the keyboard is on

function normalise(options) { // accept [ 'a', 'b' ] AND [ { value, label } ] — one shape downstream
  return (options || []).map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
}

export default function Select({ value, onChange, options, placeholder = 'Choose…', label, disabled = false, emptyText = 'No options yet' }) {
  const list = normalise(options);
  const [open, setOpen] = useState(false); // is the popover showing?
  const [at, setAt] = useState(0); // index the keyboard is on (arrow keys move it)
  const box = useRef(null); // the wrapper — an outside click is "not inside this"
  const btn = useRef(null); // the trigger — focus returns here when the pop closes
  const id = useId(); // unique ids for aria-controls / aria-activedescendant

  const current = list.find((o) => o.value === value); // the option object for the current value (undefined = placeholder state)

  useEffect(() => { // close on an outside click, and on Esc anywhere
    if (!open) return undefined;
    const onDown = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); if (btn.current) btn.current.focus(); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]); // only while open (no listener left behind!)

  useEffect(() => { // keep the keyboard's row visible when the list is longer than the pop
    if (!open) return undefined;
    const el = document.getElementById(id + '-opt-' + at);
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
    return undefined;
  }, [open, at, id]);

  function show() { // open, and park the keyboard on the current choice (not always the top)
    const i = list.findIndex((o) => o.value === value);
    setAt(i >= 0 ? i : 0);
    setOpen(true);
  }
  function pick(o) { onChange(o.value); setOpen(false); if (btn.current) btn.current.focus(); } // pick → close → focus back on the trigger (so Tab continues naturally)
  function keyDown(e) { // the whole control is operable from the trigger button
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); // stop the page scrolling while the list moves
      if (!open) { show(); return; }
      setAt((i) => Math.max(0, Math.min(list.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1))));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!open) { show(); return; }
      if (list[at]) pick(list[at]);
    } else if (e.key === 'Home') { e.preventDefault(); setAt(0); }
    else if (e.key === 'End') { e.preventDefault(); setAt(list.length - 1); }
  }

  return (
    <div className={'sel' + (open ? ' open' : '')} ref={box}>
      <button ref={btn} type="button" className="sel-btn" disabled={disabled}
        aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? id : undefined}
        aria-label={label} onClick={() => (open ? setOpen(false) : show())} onKeyDown={keyDown}>
        <span className={'sel-val' + (current ? '' : ' ph')}>{current ? current.label : placeholder}</span> {/* placeholder is a real state, greyed — never a fake option */}
        <svg className="sel-chev" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="sel-pop" role="listbox" id={id} aria-label={label}>
          {list.length === 0 && <div className="sel-empty">{emptyText}</div>}
          {list.map((o, i) => (
            <div key={o.value}>
              {o.group && list[i - 1]?.group !== o.group && <div className="sel-group">{o.group}</div>} {/* optional heading once per group — React can't render a bare string inside the map, so it is a div */}
              <button type="button" className="sel-opt" role="option" id={id + '-opt-' + i} aria-selected={o.value === value} data-active={i === at ? '1' : undefined}
                onMouseEnter={() => setAt(i)} onClick={() => pick(o)} style={o.swatch ? { paddingLeft: 10 } : undefined}>
                {o.swatch ? <span style={{ width: 14, height: 14, borderRadius: 4, background: o.swatch, flex: 'none', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.1)' }} /> : null}
                <span className="sel-opt-main">{o.label}{o.hint ? <i>{o.hint}</i> : null}</span>
                <svg className="sel-tick" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
