#!/usr/bin/env node
// Headless screenshot + debug-log reader. Zero dependencies.
// Uses an installed Chrome/Chromium/Edge/Brave. Falls back to Python Playwright.
//
//   node scripts/shot.mjs http://localhost:5151/?sim=3 shots/day4.png
//   node scripts/shot.mjs "http://localhost:5151/?sim=3" --log      prints #debuglog
//   options: --size 1440x900  --wait 12000 (virtual ms the page may run before capture)
//
// Then OPEN the png and look at it. A screenshot nobody reads verifies nothing.

import { execFile, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];
const ON_PATH = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge'];

export function findChrome() {
  for (const c of CANDIDATES) if (c && fs.existsSync(c)) return c;
  for (const name of ON_PATH) {
    try {
      const p = execFileSync(process.platform === 'win32' ? 'where' : 'which', [name], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().split('\n')[0].trim();
      if (p) return p;
    } catch {}
  }
  return null;
}

export function hasPythonPlaywright() {
  try { execFileSync('python3', ['-c', 'import playwright'], { stdio: 'ignore' }); return true; } catch { return false; }
}

const run = (cmd, args, timeout) => new Promise((resolve, reject) => {
  execFile(cmd, args, { timeout, maxBuffer: 64 << 20 }, (err, stdout, stderr) => (err && !stdout ? reject(new Error(stderr || err.message)) : resolve(stdout)));
});

function chromeArgs({ width, height, wait }) {
  return [
    '--headless=new', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
    '--disable-gpu-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
    `--window-size=${width},${height}`, `--virtual-time-budget=${wait}`,
  ];
}

const PY = `
import sys, asyncio
from playwright.sync_api import sync_playwright
url, out, w, h, wait, mode = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5]), sys.argv[6]
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    pg = b.new_page(viewport={"width": w, "height": h})
    pg.goto(url, wait_until="load")
    try:
        pg.wait_for_function("document.getElementById('debuglog') && document.getElementById('debuglog').textContent.includes('ready')", timeout=wait)
    except Exception:
        pass
    pg.wait_for_timeout(min(wait, 4000))
    if mode == "log":
        el = pg.query_selector("#debuglog")
        print(el.text_content() if el else "")
    else:
        pg.screenshot(path=out)
    b.close()
`;

export async function screenshot({ url, out = 'shot.png', width = 1440, height = 900, wait = 12000 }) {
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  const chrome = findChrome();
  if (chrome) {
    const abs = path.resolve(out);
    await run(chrome, [...chromeArgs({ width, height, wait }), `--screenshot=${abs}`, url], wait + 60000);
    if (fs.existsSync(abs)) return { out: abs, via: 'chrome' };
  }
  if (hasPythonPlaywright()) {
    await run('python3', ['-c', PY, url, path.resolve(out), String(width), String(height), String(wait), 'shot'], wait + 60000);
    return { out: path.resolve(out), via: 'playwright' };
  }
  throw new Error('No browser found. Install Google Chrome (or set CHROME_PATH), or: pip install playwright && playwright install chromium');
}

// read the page's <pre id="debuglog"> after it ran (for ?sim=N and ?gallery)
export async function debuglog({ url, wait = 12000 }) {
  const chrome = findChrome();
  if (chrome) {
    const html = await run(chrome, [...chromeArgs({ width: 1280, height: 800, wait }), '--dump-dom', url], wait + 60000);
    const m = html.match(/<pre id="debuglog"[^>]*>([\s\S]*?)<\/pre>/);
    return m ? m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim() : '';
  }
  if (hasPythonPlaywright()) return (await run('python3', ['-c', PY, url, '-', '1280', '800', String(wait), 'log'], wait + 60000)).trim();
  throw new Error('No browser found for --log.');
}

// CLI
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args.splice(i, 2)[1] : d; };
  const flag = (n) => { const i = args.indexOf(`--${n}`); if (i >= 0) args.splice(i, 1); return i >= 0; };
  const [w, h] = opt('size', '1440x900').split('x').map(Number);
  const wait = Number(opt('wait', 12000));
  const wantLog = flag('log');
  const [url, out = 'shots/shot.png'] = args;
  if (!url) { console.log('usage: node scripts/shot.mjs <url> [out.png] [--size 1440x900] [--wait 12000] [--log]'); process.exit(1); }
  try {
    if (wantLog) console.log(await debuglog({ url, wait }));
    else { const r = await screenshot({ url, out, width: w, height: h, wait }); console.log(`saved ${r.out} (via ${r.via}). Now open it and look.`); }
  } catch (e) { console.error(e.message); process.exit(1); }
}
