#!/usr/bin/env node
// Zero-dependency game server: serves public/ and your asset folder at /files/.
//
//   node server.mjs                         port + assets from game.config.json
//   node server.mjs --port 5252 --assets ~/game-assets
//   PORT=5252 ASSETS_DIR=~/game-assets node server.mjs
//
// /api/models lists every model file in the asset folder, so the game can find
// "hex_grass.gltf" wherever you unzipped the pack.

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(HERE, 'public');

let config = {};
try { config = JSON.parse(fs.readFileSync(path.join(HERE, 'game.config.json'), 'utf8')); } catch {}
const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const expand = (p) => path.resolve(HERE, p.replace(/^~(?=$|\/)/, os.homedir()));

const PORT = Number(arg('port') || process.env.PORT || config.port || 5151);
const ASSETS = expand(arg('assets') || process.env.ASSETS_DIR || config.assets || './assets');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream',
  '.obj': 'text/plain; charset=utf-8', '.mtl': 'text/plain; charset=utf-8', '.fbx': 'application/octet-stream',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
};

function send(res, code, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type });
  res.end(body);
}

function serveFile(res, abs, root) {
  if (abs !== root && !abs.startsWith(root + path.sep)) return send(res, 403, 'forbidden');
  fs.stat(abs, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'not found');
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(abs).pipe(res);
  });
}

function listModels(dir, out = [], depth = 0) {
  if (depth > 12) return out;
  let names = [];
  try { names = fs.readdirSync(dir); } catch { return out; }
  for (const n of names) {
    if (n.startsWith('.') || n === '__MACOSX' || n === 'node_modules') continue;
    const full = path.join(dir, n);
    let st;
    try { st = fs.statSync(full); } catch { continue; }
    if (st.isDirectory()) listModels(full, out, depth + 1);
    else if (/\.(glb|gltf|obj|fbx)$/i.test(n)) out.push(path.relative(ASSETS, full).split(path.sep).join('/'));
  }
  return out;
}
let MODELS = null;

http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { return send(res, 400, 'bad url'); }
  if (p === '/api/models') {
    if (!MODELS || new URL(req.url, 'http://x').searchParams.has('rescan')) MODELS = listModels(ASSETS);
    return send(res, 200, JSON.stringify({ assets: ASSETS, models: MODELS }), 'application/json');
  }
  if (p.startsWith('/files/')) return serveFile(res, path.resolve(ASSETS, p.slice(7)), ASSETS);
  const rel = p === '/' ? 'index.html' : p.replace(/^\/+/, '');
  serveFile(res, path.resolve(PUBLIC, rel), PUBLIC);
}).listen(PORT, () => {
  const has = fs.existsSync(ASSETS);
  console.log(`\n  ${config.name || 'game'} -> http://localhost:${PORT}`);
  console.log(`  assets: ${ASSETS}${has ? '' : '  (missing: the game will use coloured shapes)'}\n`);
});
