// ── frontend/src/lib/rich.jsx ──────────────────────────────────────
// WHAT: turns ONE AI answer into readable blocks — paragraphs, bullets,
// numbered steps, quotes — and renders them as real <p> / <ul> / <ol> instead
// of one wall of pre-wrapped text. This is the difference between an answer
// that looks like a chat and a paragraph that happens to live in a bubble.
//
// NOT a Markdown engine, deliberately. Every answer already passes through
// replyEngine.cleanReply() on the server, which strips #, **, backticks, ~~
// and [links]. What it KEEPS is the shape: "• " per option (it rewrites - and
// + to a bullet), "1." per step, and one idea per line. So this reads THAT
// shape. The tiny inline pass for **bold** / `code` is defensive only — it
// never fires today and costs nothing if a future brain skips the cleaner.
//
// <p> is white-space: pre-line, so single line breaks survive. That matters:
// the prompt tells models to put each step on its own line, and flattening
// those onto one line would undo the structure we are trying to show.
import { Fragment } from 'react';

const BULLET = /^\s*[-–—•·*+]\s+(.*)$/; // "• item" (cleanReply rewrites - and + to •)
const ORDERED = /^\s*(\d{1,3})[.)]\s+(.*)$/; // "1. step" / "2) step"
const HEADING = /^\s*(#{1,4})\s+(.*)$/; // defensive: cleanReply strips these
const QUOTE = /^\s*>\s?(.*)$/;
const INLINE = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\[[^\]\n]+\]\([^()\s]+\))/g;

// One line's inline runs. `seed` keeps React keys stable across re-renders
// while the answer streams in (unstable keys would remount the element and
// replay its entry animation on every tick).
function inline(text, seed) {
  return String(text).split(INLINE).map((part, i) => {
    const k = seed + 'i' + i;
    if (part === '') return null;
    if (/^\*\*[^*\n]+\*\*$/.test(part)) return <strong key={k}>{part.slice(2, -2)}</strong>;
    if (/^`[^`\n]+`$/.test(part)) return <code key={k}>{part.slice(1, -1)}</code>;
    const link = /^\[([^\]\n]+)\]\(([^()\s]+)\)$/.exec(part);
    if (link) return <a key={k} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>;
    return <Fragment key={k}>{part}</Fragment>;
  });
}

export default function Rich({ text, seed = 'r' }) {
  const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let para = null; // string[] open paragraph
  let list = null; // { ordered, items: string[] } open list
  let quote = null; // string[] open blockquote

  const closePara = () => { if (para) { blocks.push({ t: 'p', text: para.join('\n') }); para = null; } };
  const closeList = () => { if (list) { blocks.push({ t: 'l', ordered: list.ordered, items: list.items }); list = null; } };
  const closeQuote = () => { if (quote) { blocks.push({ t: 'q', text: quote.join('\n') }); quote = null; } };
  const closeAll = () => { closePara(); closeList(); closeQuote(); };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) { closeAll(); continue; } // blank line = block boundary

    const h = HEADING.exec(line);
    if (h) { closeAll(); blocks.push({ t: 'h', text: h[2], n: h[1].length }); continue; }

    const q = QUOTE.exec(line);
    if (q) { closePara(); closeList(); (quote ||= []).push(q[1]); continue; }

    const b = BULLET.exec(line);
    if (b) {
      closePara(); closeQuote();
      if (!list || list.ordered) { closeList(); list = { ordered: false, items: [] }; }
      list.items.push(b[1]);
      continue;
    }

    const o = ORDERED.exec(line);
    if (o) {
      closePara(); closeQuote();
      if (!list || !list.ordered) { closeList(); list = { ordered: true, items: [] }; }
      list.items.push(o[2]);
      continue;
    }

    closeList(); closeQuote();
    (para ||= []).push(line.trim());
  }
  closeAll();

  return (
    <div className="rich">
      {blocks.map((blk, i) => {
        const k = seed + 'b' + i;
        if (blk.t === 'p') return <p key={k}>{inline(blk.text, k)}</p>;
        if (blk.t === 'h') return blk.n <= 2 ? <h3 key={k}>{inline(blk.text, k)}</h3> : <h4 key={k}>{inline(blk.text, k)}</h4>;
        if (blk.t === 'q') return <blockquote key={k}>{inline(blk.text, k)}</blockquote>;
        if (blk.t === 'l') {
          const items = blk.items.map((it, j) => <li key={k + 'n' + j}>{inline(it, k + 'n' + j)}</li>);
          return blk.ordered ? <ol key={k}>{items}</ol> : <ul key={k}>{items}</ul>;
        }
        return null;
      })}
    </div>
  );
}
