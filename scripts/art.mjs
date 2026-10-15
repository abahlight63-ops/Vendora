// ── scripts/art.mjs ──────────────────────────────────────────────
// WHAT: CLI wrapper around src/services/art.js — generate an image from
// the terminal (or from opencode) without starting the backend.
//   npm run art -- "friendly green robot mascot waving" out.png 1024 512
// Uses the same key env (POLLINATIONS_API_KEY) — keyed = no watermark.
// Prints the seed so you can regenerate a stable image:
//   npm run art -- "same prompt" out.png 1024 512 --seed 20240906
'use strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { config } = require('dotenv');
config(); // load .env so POLLINATIONS_API_KEY works exactly like the server

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { generate } = require(path.join(__dirname, '..', 'src', 'services', 'art.js'));

function usage() {
  console.error(
    'Usage: node scripts/art.mjs "<prompt>" <out.png> [width] [height] [--seed N | --model M | --key]\n' +
    '  width/height default 1024 (each 256–1536). --model picks a Pollinations model.\n' +
    '  --key prints the watermark status (shows whether POLLINATIONS_API_KEY is set & accepted).'
  );
  process.exit(1);
}

async function main(argv) {
  const positional = [];
  let seed;
  let model;
  let wantKeyInfo = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--key') wantKeyInfo = true;
    else if (a === '--seed') seed = Number(argv[++i]);
    else if (a.startsWith('--seed=')) seed = Number(a.split('=')[1]);
    else if (a === '--model') model = argv[++i];
    else if (a.startsWith('--model=')) model = a.split('=')[1];
    else positional.push(a);
  }
  if (positional.length < 2) usage();
  const [prompt, outFile] = positional;
  const width = Number(positional[2]) || 1024;
  const height = Number(positional[3]) || 1024;

  const key = (process.env.POLLINATIONS_API_KEY || '').trim();
  if (wantKeyInfo) {
    if (!key) console.log('Key: NOT set in .env → anonymous (watermark will appear).');
    else console.log(`Key: set (${key.length} chars) → sent as token; watermark removed if valid.`);
  }

  const started = Date.now();
  try {
    const { seed: usedSeed, buf, type } = await generate({ prompt, width, height, seed, model });
    writeFileSync(outFile, buf);
    console.log(`OK  ${type}  ${(buf.length / 1024).toFixed(1)} KiB  ${Date.now() - started}ms  seed=${usedSeed}`);
    console.log(`    → ${path.resolve(outFile)}`);
  } catch (e) {
    console.error('ERR', e.message);
    process.exit(1);
  }
}

main(process.argv.slice(2));