// scripts/sitemap.mjs — one command, both surfaces.
//
//   node scripts/sitemap.mjs        (or: npm run sitemap)
//
// WHY THIS EXISTS: a sitemap is only useful if it matches the pages that
// actually exist. Hand-written XML drifts the first time someone adds a page
// and forgets. So this script walks the real files:
//
//   website/**/index.html   → https://velosalesai.com.ng/<path>/
//   website/404.html        → never (noindex)
//
// The app's public routes are a short fixed list on purpose — everything
// behind the login is private and must never be advertised to a crawler.
//
// ETAGS ARE NOT ENOUGH FOR GOOGLE: lastmod comes from the file's mtime, so a
// sitemap diff means a page really changed. That is the signal Search Console
// uses to decide whether to re-crawl.

import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://velosalesai.com.ng';
const APP = 'https://app.velosalesai.com.ng';

const today = new Date().toISOString().slice(0, 10);
const dateOf = (file) => {
  try { return statSync(file).mtime.toISOString().slice(0, 10); } catch { return today; }
};

/** Every folder in website/ that contains an index.html. */
function findPages(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'assets') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) findPages(full, out);
    else if (entry.name === 'index.html') out.push(full);
  }
  return out;
}

const websiteDir = join(ROOT, 'website');
const pages = findPages(websiteDir).map((file) => {
  const rel = relative(websiteDir, file).replace(/\\/g, '/');
  const path = rel === 'index.html' ? '' : rel.replace(/\/?index\.html$/, '/');
  const url = SITE + '/' + path;
  const depth = path.split('/').filter(Boolean).length;
  return {
    url,
    lastmod: dateOf(file),
    changefreq: path === '' ? 'weekly' : 'monthly',
    priority: path === '' ? '1.0' : depth === 1 ? '0.9' : '0.6',
    file: 'website/' + rel,
  };
});

// Highest priority first, then alphabetical — a readable diff.
pages.sort((a, b) => Number(b.priority) - Number(a.priority) || a.url.localeCompare(b.url));

const xmlFor = (entries) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map((e) => `  <url>
    <loc>${e.url}</loc>
    <lastmod>${e.lastmod}</lastmod>
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;

const websiteXml = xmlFor(pages);
writeFileSync(join(websiteDir, 'sitemap.xml'), websiteXml, 'utf8');

// The app: public routes only. The dashboard, inbox and everything else is
// behind auth and disallowed in robots.txt.
const appPaths = [
  { path: '', priority: '1.0', changefreq: 'weekly' },
  { path: 'login', priority: '0.8', changefreq: 'monthly' },
  { path: 'faq', priority: '0.6', changefreq: 'monthly' },
  { path: 'privacy', priority: '0.3', changefreq: 'yearly' },
  { path: 'terms', priority: '0.3', changefreq: 'yearly' },
];
const appEntries = appPaths.map((p) => ({
  url: APP + '/' + p.path,
  lastmod: today,
  changefreq: p.changefreq,
  priority: p.priority,
}));
const appXml = xmlFor(appEntries);

writeFileSync(join(ROOT, 'frontend', 'public', 'sitemap.xml'), appXml, 'utf8');
if (existsSync(join(ROOT, 'dist'))) writeFileSync(join(ROOT, 'dist', 'sitemap.xml'), appXml, 'utf8');

// A tiny report, so a build log proves what was published.
console.log(`website sitemap: ${pages.length} pages`);
for (const p of pages) console.log(`  ${p.priority}  ${p.url}  (${p.file})`);
console.log(`app sitemap: ${appEntries.length} public routes → /sitemap.xml`);

// Guard rails: catch the two mistakes that silently break indexing.
const titles = pages.map((p) => {
  const html = readFileSync(join(ROOT, p.file), 'utf8');
  const t = html.match(/<title>([^<]+)<\/title>/i);
  const h1 = html.match(/<h1[^>]*>/gi) || [];
  if (!t) console.warn(`  ! ${p.file} has no <title>`);
  if (h1.length !== 1) console.warn(`  ! ${p.file} has ${h1.length} <h1> tags (want exactly 1)`);
  return t ? t[1] : '';
});
const dupes = titles.filter((t, i) => t && titles.indexOf(t) !== i);
if (dupes.length) console.warn(`  ! duplicate titles: ${[...new Set(dupes)].join(' | ')}`);
