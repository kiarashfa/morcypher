/* Idempotent analytics injector.
 *
 * Inserts a single ID-free loader line before </head> in every HTML page at the
 * repo root. Pages that already have it are skipped, so this is safe to re-run
 * whenever a new page is added:
 *
 *   node tools/inject-analytics.mjs
 *
 * The measurement ID itself lives only in analytics.js.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const BASE = '/morcypher/';
const TAG = `<script async src="${BASE}analytics.js"></script>`;

const pages = readdirSync('.').filter(f => f.endsWith('.html'));
let added = 0;

for (const file of pages) {
  const html = readFileSync(file, 'utf8');

  if (html.includes('analytics.js')) {
    console.log(`skip  ${file} (already tagged)`);
    continue;
  }
  if (!html.includes('</head>')) {
    console.log(`skip  ${file} (no </head>)`);
    continue;
  }

  writeFileSync(file, html.replace('</head>', `${TAG}\n</head>`), 'utf8');
  console.log(`add   ${file}`);
  added++;
}

console.log(`\n${pages.length} page(s), ${added} tagged this run.`);
