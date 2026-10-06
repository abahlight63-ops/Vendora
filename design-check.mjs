#!/usr/bin/env node
/**
 * design-check - the gate the spec runs after every step.
 *
 *   node design-check.mjs frontend/src
 *
 * Verifies the parts of the spec that are cheap to check mechanically and hard
 * to keep true by hand: split file structure, one token block, no banned
 * effects, one font family, the permitted breakpoints, no imports of removed
 * dependencies. Exits non-zero on a violation so it can sit in a pre-commit
 * hook or CI.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2] || 'frontend/src';

const REQUIRED_FILES = [
  'styles/tokens.css',
  'styles/base.css',
  'styles/layout.css',
  'styles/components.css',
  'styles/pages.css',
];

// Properties/effects the spec deletes outright.
const BANNED = [
  ['!important', '!important'],
  ['Cormorant', 'the serif font from the old pass'],
  ['JetBrains', 'the mono font from the old pass'],
  ['btn-gold-grad', 'the gold gradient button'],
  ['text-transform: uppercase', 'all-caps styling (spec 4 wants sentence case)'],
  ['neumorph', 'neumorphism'],
  ['skelShimmer', 'the skeleton shimmer sweep'],
];

// The breakpoints the spec permits. Spec 3 lists mobile max-width 639,
// tablet 640-1023, desktop min-width 1024. Extra ones mean dead rules.
const ALLOWED_BPS = [
  'max-width: 639px',
  'max-width: 1023px',
  'min-width: 640px',
  'min-width: 1024px',
];

// Feature queries are not breakpoints. Reduced motion and reduced transparency
// are accessibility affordances the spec requires (section 11) and must stay.
const FEATURE_QUERIES = [
  'prefers-reduced-motion',
  'prefers-reduced-transparency',
  'prefers-color-scheme',
  'forced-colors',
];

const errors = [];
const warnings = [];
const stats = { files: 0, rules: 0, vars: 0 };

// --- 1. the split files exist -------------------------------------------------
for (const f of REQUIRED_FILES) {
  const p = path.join(root, f);
  if (!fs.existsSync(p)) errors.push('missing ' + f);
  else stats.files++;
}

function walkCss(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkCss(p, out);
    else if (e.name.endsWith('.css')) out.push(p);
  }
  return out;
}

function walkJs(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkJs(p, out);
    else if (/\.jsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

const files = walkCss(path.join(root, 'styles'));

for (const file of files) {
  const rel = path.relative(root, file);
  const raw = fs.readFileSync(file, 'utf8');
  // Strip block comments before scanning: a note saying "we removed X" must not
  // trip the check for X. (Only /* */ is stripped — CSS has no // comments and
  // url(//cdn) must survive intact.) Balance is checked on the raw text below.
  const text = raw.replace(/\/\*[\s\S]*?\*\//g, '');

  const open = (raw.match(/\{/g) || []).length;
  const close = (raw.match(/\}/g) || []).length;
  if (open !== close) errors.push(rel + ': unbalanced braces ' + open + '/' + close);
  stats.rules += open;

  for (const [pattern, label] of BANNED) {
    if (text.includes(pattern)) errors.push(rel + ': ' + label + ' (' + pattern + ')');
  }

  // the token file holds exactly one :root and one dark block
  if (rel.endsWith('tokens.css')) {
    const roots = (text.match(/(^|\})\s*:root\s*\{/gm) || []).length;
    const dark = (text.match(/\[data-theme="dark"\]\s*\{/g) || []).length;
    if (roots !== 1) errors.push('tokens.css: expected 1 :root block, found ' + roots);
    if (dark !== 1) errors.push('tokens.css: expected 1 [data-theme="dark"] block, found ' + dark);
  }

  // font-family must only ever name Figtree
  const families = [...text.matchAll(/font-family:\s*([^;]+)/g)].map((m) => m[1]);
  for (const fam of families) {
    const withoutVars = fam.replace(/var\(--font[^)]*\)/g, '').replace(/[^a-zA-Z]/g, '');
    if (withoutVars && !/figtree/i.test(withoutVars) && !/systemui/i.test(fam)) {
      errors.push(rel + ': font-family not in the spec: ' + fam.trim().slice(0, 50));
    }
  }

  // media queries stay inside the permitted breakpoints
  for (const m of text.matchAll(/@media[^{]+/g)) {
    const q = m[0];
    const isFeature = FEATURE_QUERIES.some((f) => q.includes(f));
    if (isFeature) continue;
    for (const part of q.split(',').map((s) => s.trim())) {
      if (!ALLOWED_BPS.some((b) => part.includes(b))) {
        errors.push(rel + ': non-spec breakpoint "' + part.slice(0, 44) + '"');
      }
    }
  }

  // duplicate custom properties inside one block mean a stale override
  for (const block of text.matchAll(/(^|\})\s*([^{}]+)\{/gm)) {
    const start = block.index + block[0].length - 1;
    const end = text.indexOf('}', start);
    if (end === -1) continue;
    const body = text.slice(start, end + 1);
    const seen = new Set();
    for (const prop of body.matchAll(/(--[\w-]+)\s*:/g)) {
      const key = prop[1];
      if (seen.has(key)) warnings.push(rel + ': ' + key + ' declared twice in one block');
      seen.add(key);
    }
    stats.vars += seen.size;
  }
}

// --- named primitives the spec requires ---------------------------------------
const PRIMITIVES = ['components/ui/Button.jsx', 'components/ui/Icon.jsx', 'components/ui/cn.js'];
for (const p of PRIMITIVES) {
  if (!fs.existsSync(path.join(root, p))) warnings.push('primitive not built yet: ' + p);
}

// --- no import of a dependency the spec removed --------------------------------
const FORBIDDEN_IMPORTS = ['lucide-react', 'clsx', 'tailwind-merge', '@radix-ui/react-'];
for (const f of walkJs(root)) {
  const text = fs.readFileSync(f, 'utf8');
  for (const dep of FORBIDDEN_IMPORTS) {
    // match a real import statement only, so a word in a comment is not a hit
    const quoted = [...text.matchAll(/(?:^|\n)\s*import[^;\n]*["']([^"']*)["']/g)].map((m) => m[1]);
    if (quoted.some((q) => q === dep || q.startsWith(dep + '/'))) {
      errors.push(path.relative(root, f) + ': imports removed dependency "' + dep + '"');
    }
  }
}

// --- report --------------------------------------------------------------------
console.log('design-check: ' + root);
console.log('  ' + stats.files + ' style files, ' + stats.rules + ' rules, ' + stats.vars + ' custom properties\n');

if (warnings.length) {
  console.log('WARNINGS (' + warnings.length + '):');
  for (const w of warnings) console.log('  ~ ' + w);
  console.log('');
}
if (errors.length) {
  console.log('VIOLATIONS (' + errors.length + '):');
  for (const e of errors) console.log('  x ' + e);
  console.log('\nFAIL');
  process.exit(1);
}
console.log(
  'PASS - no spec violations in ' + files.length + ' style files and ' +
  PRIMITIVES.length + ' named primitives (' + root + ')'
);