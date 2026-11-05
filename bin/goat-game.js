#!/usr/bin/env node
// goat-game: tiny toolkit for building browser 3D games with Claude Code.
//   goat-game new <name>        copy the hex starter, set port + assets folder
//   goat-game explore <dir>     browse a folder of 3D assets in the browser
//   goat-game shot <url> [png]  headless screenshot (or --log to read #debuglog)
//   goat-game doctor            check node, a screenshot browser, your assets
// Zero dependencies.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const STARTER = path.join(REPO, 'starter');
const VERSION = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8')).version;

const color = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);
const ok = (s) => console.log(`  ${c(32, 'ok')}    ${s}`);
const warn = (s) => console.log(`  ${c(33, 'warn')}  ${s}`);
const bad = (s) => console.log(`  ${c(31, 'fail')}  ${s}`);
const expand = (p) => path.resolve(p.replace(/^~(?=$|\/)/, os.homedir()));

const argv = process.argv.slice(2);
const cmd = argv.shift();
const opt = (name, def) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv.splice(i, 2)[1] : def; };
const flag = (name) => { const i = argv.indexOf(`--${name}`); if (i >= 0) argv.splice(i, 1); return i >= 0; };

const HELP = `
   (\\_/)
   (o.o)  goat-game ${VERSION}: turn Claude Code into a game studio
   />⚔

  goat-game new <name> [--port 5151] [--assets <dir>] [--force]
      copy the hex starter game into ./<name>
  goat-game explore <dir> [--port 4848]
      browse every glb/gltf/obj/fbx in a folder, with live 3D previews
  goat-game shot <url> [out.png] [--size 1440x900] [--wait 12000] [--log]
      headless screenshot of your game. --log prints the page's #debuglog instead
  goat-game doctor [--assets <dir>]
      check node, a screenshot browser and your asset folder

  Assets are not included. Free CC0 packs: kaylousberg.itch.io, kenney.nl, quaternius.com
`;

// ───────────────────────────────────────────── new

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    if (['node_modules', 'shots', 'assets', '.DS_Store'].includes(name)) continue;
    const s = path.join(src, name), d = path.join(dst, name);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function cmdNew() {
  const name = argv.find((a) => !a.startsWith('--'));
  const force = flag('force');
  const port = Number(opt('port', 5151));
  const assetsArg = opt('assets', process.env.GOAT_ASSETS);
  if (!name) { console.log('usage: goat-game new <name> [--port 5151] [--assets <dir>]'); process.exit(1); }
  const dst = path.resolve(name);
  if (fs.existsSync(dst) && fs.readdirSync(dst).length && !force) {
    bad(`${dst} exists and is not empty (use --force to copy over it)`);
    process.exit(1);
  }
  copyDir(STARTER, dst);
  const assets = assetsArg ? expand(assetsArg) : './assets';
  if (!assetsArg) fs.mkdirSync(path.join(dst, 'assets'), { recursive: true });
  const title = path.basename(dst).replace(/[-_]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  fs.writeFileSync(path.join(dst, 'game.config.json'), JSON.stringify({ name: title, port, assets }, null, 2) + '\n');
  const pkgPath = path.join(dst, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.name = path.basename(dst).toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  const html = path.join(dst, 'public', 'index.html');
  fs.writeFileSync(html, fs.readFileSync(html, 'utf8').replace(/Hex Starter/g, title));

  console.log(`\n  ${c(1, title)} is ready in ${dst}\n`);
  ok(`port ${port}`);
  if (assetsArg) (fs.existsSync(assets) ? ok : warn)(`assets ${assets}${fs.existsSync(assets) ? '' : ' (folder not found yet)'}`);
  else warn(`no --assets given: unzip KayKit Medieval Hexagon into ${path.join(dst, 'assets')} (until then you get coloured shapes)`);
  console.log(`
  next:
    cd ${path.relative(process.cwd(), dst) || '.'}
    node server.mjs                 # http://localhost:${port}
    npm test                        # sim + promise tests
    node scripts/shot.mjs "http://localhost:${port}/?sim=3" shots/day4.png
`);
}

// ───────────────────────────────────────────── explore

async function cmdExplore() {
  const dir = argv.find((a) => !a.startsWith('--')) || opt('dir') || process.env.GOAT_ASSETS;
  const port = Number(opt('port', 4848));
  if (!dir) { console.log('usage: goat-game explore <dir> [--port 4848]'); process.exit(1); }
  const { startExplorer } = await import('../explorer/server.mjs');
  try { await startExplorer({ dir, port }); } catch (e) {
    bad(e.code === 'EADDRINUSE' ? `port ${port} is taken, try --port ${port + 1}` : e.message);
    process.exit(1);
  }
}

// ───────────────────────────────────────────── shot

async function cmdShot() {
  const size = opt('size', '1440x900');
  const wait = Number(opt('wait', 12000));
  const log = flag('log');
  const [url, out = 'shots/shot.png'] = argv.filter((a) => !a.startsWith('--'));
  if (!url) { console.log('usage: goat-game shot <url> [out.png] [--size 1440x900] [--wait 12000] [--log]'); process.exit(1); }
  const { screenshot, debuglog } = await import('../starter/scripts/shot.mjs');
  try {
    if (log) console.log(await debuglog({ url, wait }));
    else {
      const [width, height] = size.split('x').map(Number);
      const r = await screenshot({ url, out, width, height, wait });
      ok(`saved ${r.out} (via ${r.via}). Open it and look.`);
    }
  } catch (e) { bad(e.message); process.exit(1); }
}

// ───────────────────────────────────────────── doctor

function countModels(dir, depth = 0, acc = { n: 0, files: new Set(), names: [] }) {
  if (depth > 10 || acc.n > 50000) return acc;
  let names = [];
  try { names = fs.readdirSync(dir); } catch { return acc; }
  for (const n of names) {
    if (n.startsWith('.') || n === 'node_modules' || n === '__MACOSX') continue;
    const full = path.join(dir, n);
    let st;
    try { st = fs.statSync(full); } catch { continue; }
    if (st.isDirectory()) { if (depth === 0) acc.names.push(n); countModels(full, depth + 1, acc); }
    else if (/\.(glb|gltf|obj|fbx)$/i.test(n)) { acc.n++; acc.files.add(n.toLowerCase()); }
  }
  return acc;
}

async function cmdDoctor() {
  let problems = 0;
  console.log(`\n  goat-game doctor\n`);
  const major = Number(process.versions.node.split('.')[0]);
  if (major >= 18) ok(`node ${process.versions.node}`); else { bad(`node ${process.versions.node}: need 18 or newer`); problems++; }

  const { findChrome, hasPythonPlaywright } = await import('../starter/scripts/shot.mjs');
  const chrome = findChrome();
  if (chrome) ok(`screenshot browser: ${chrome}`);
  else if (hasPythonPlaywright()) ok('screenshot browser: python playwright');
  else { bad('no browser for screenshots: install Chrome (or set CHROME_PATH), or pip install playwright && playwright install chromium'); problems++; }

  try {
    execFileSync(process.platform === 'win32' ? 'where' : 'which', ['claude'], { stdio: 'ignore' });
    ok('claude CLI on PATH');
  } catch { warn('claude CLI not found on PATH (install Claude Code to use the /make-game skill)'); }

  try {
    const r = await fetch('https://cdn.jsdelivr.net/npm/three@0.169.0/package.json', { signal: AbortSignal.timeout(4000) });
    if (r.ok) ok('three.js CDN reachable (games load three.js from jsDelivr)'); else throw new Error(String(r.status));
  } catch { warn('could not reach cdn.jsdelivr.net: games need internet on first load for three.js'); }

  let assets = opt('assets', process.env.GOAT_ASSETS);
  if (!assets && fs.existsSync('game.config.json')) {
    try { assets = path.resolve(JSON.parse(fs.readFileSync('game.config.json', 'utf8')).assets || './assets'); } catch {}
  }
  if (!assets) warn('no asset folder given: pass --assets <dir> (or run doctor inside a game folder)');
  else {
    const dir = expand(assets);
    if (!fs.existsSync(dir)) { bad(`asset folder not found: ${dir}`); problems++; }
    else {
      const r = countModels(dir);
      (r.n ? ok : warn)(`asset folder ${dir}: ${r.n} model files`);
      if (r.files.has('hex_grass.gltf') || r.files.has('hex_grass.glb')) ok('KayKit Medieval Hexagon found: the starter will use real models');
      else warn('KayKit Medieval Hexagon not found: the starter falls back to coloured shapes (free at kaylousberg.itch.io)');
      const top = r.names.join(' ').toLowerCase();
      if (/kenney/.test(top)) ok('Kenney packs found (OBJ colours are linear: see asset-gotchas)');
      if (/quaternius/.test(top)) ok('Quaternius packs found');
    }
  }
  console.log(problems ? `\n  ${problems} problem(s) to fix.\n` : '\n  All set. Ask Claude: /make-game\n');
  process.exitCode = problems ? 1 : 0;
}

// ───────────────────────────────────────────── main

const commands = { new: cmdNew, explore: cmdExplore, shot: cmdShot, doctor: cmdDoctor };
if (cmd === '--version' || cmd === '-v') console.log(VERSION);
else if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h' || !commands[cmd]) {
  console.log(HELP);
  if (cmd && !['help', '--help', '-h'].includes(cmd)) process.exitCode = 1;
} else await commands[cmd]();
