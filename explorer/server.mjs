#!/usr/bin/env node
// goat explorer: browse any folder of 3D assets with live three.js previews.
// Zero dependencies. Point it at a folder and open the URL.
//
//   node explorer/server.mjs --dir ~/game-assets            -> http://localhost:4848
//   node explorer/server.mjs --dir ~/game-assets --port 4850
//   ASSETS_DIR=~/game-assets PORT=4850 node explorer/server.mjs
//
// Read-only: it never writes into your asset folder. Thumbnails are cached in
// your OS temp folder (or --thumbs <dir>).

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildIndex, hashId } from './indexer.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(HERE, 'public');

export function startExplorer({ dir, port = 4848, thumbs, quiet = false } = {}) {
  const ROOT = path.resolve(dir.replace(/^~(?=$|\/)/, os.homedir()));
  if (!fs.existsSync(ROOT) || !fs.statSync(ROOT).isDirectory()) throw new Error(`Not a folder: ${ROOT}`);
  const THUMBS = path.resolve(thumbs || path.join(os.tmpdir(), 'goat-explorer-thumbs', hashId(ROOT)));
  fs.mkdirSync(THUMBS, { recursive: true });

  const MIME = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.json': 'application/json', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream',
    '.obj': 'text/plain; charset=utf-8', '.mtl': 'text/plain; charset=utf-8', '.fbx': 'application/octet-stream',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
    '.tga': 'image/x-tga',
  };

  let INDEX_JSON = '';
  const scan = () => {
    const t = Date.now();
    const ix = buildIndex(ROOT);
    const home = os.homedir();
    ix.rootLabel = ROOT === home || ROOT.startsWith(home + path.sep) ? '~' + ROOT.slice(home.length) : ROOT;
    INDEX_JSON = JSON.stringify(ix);
    if (!quiet) console.log(`  indexed ${ix.assets.length} models in ${ix.packs.length} packs (${Date.now() - t} ms)`);
    return ix;
  };

  const send = (res, code, body, type = 'text/plain; charset=utf-8') => { res.writeHead(code, { 'Content-Type': type }); res.end(body); };
  const inside = (abs, root) => abs === root || abs.startsWith(root + path.sep);
  function serveFile(res, abs, root) {
    if (!inside(abs, root)) return send(res, 403, 'forbidden');
    fs.stat(abs, (err, st) => {
      if (err || !st.isFile()) return send(res, 404, 'not found');
      res.writeHead(200, { 'Content-Type': MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': 'no-cache' });
      fs.createReadStream(abs).pipe(res);
    });
  }

  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    let p;
    try { p = decodeURIComponent(u.pathname); } catch { return send(res, 400, 'bad url'); }
    if (req.method === 'GET') {
      if (p === '/api/index') { if (!INDEX_JSON) scan(); return send(res, 200, INDEX_JSON, 'application/json'); }
      if (p.startsWith('/files/')) return serveFile(res, path.resolve(ROOT, p.slice(7)), ROOT);
      if (p.startsWith('/thumbs/')) {
        const name = path.basename(p);
        if (!/^[a-z0-9]+\.png$/.test(name)) return send(res, 400, 'bad id');
        // 204 (not 404) for "not rendered yet": the browser renders it and keeps the console clean
        if (!fs.existsSync(path.join(THUMBS, name))) { res.writeHead(204); return res.end(); }
        return serveFile(res, path.join(THUMBS, name), THUMBS);
      }
      const rel = p === '/' ? 'index.html' : p.replace(/^\/+/, '');
      return serveFile(res, path.resolve(PUBLIC, rel), PUBLIC);
    }
    if (req.method === 'POST' && p === '/api/rescan') { scan(); return send(res, 200, 'ok'); }
    if (req.method === 'POST' && p === '/api/thumb') {
      let body = '';
      req.on('data', (c) => { body += c; if (body.length > 4e6) req.destroy(); });
      req.on('end', () => {
        try {
          const { id, data } = JSON.parse(body);
          if (!/^[a-z0-9]+$/.test(id)) throw new Error('bad id');
          fs.writeFile(path.join(THUMBS, `${id}.png`), Buffer.from(data.replace(/^data:image\/png;base64,/, ''), 'base64'), () => {});
          send(res, 200, 'ok');
        } catch { send(res, 400, 'bad request'); }
      });
      return;
    }
    send(res, 405, 'method not allowed');
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => {
      if (!quiet) console.log(`\n  goat explorer -> http://localhost:${port}\n  folder: ${ROOT}`);
      scan();
      if (!quiet) console.log('');
      resolve(server);
    });
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const arg = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
  const dir = arg('dir') || process.env.ASSETS_DIR || (args[0] && !args[0].startsWith('--') ? args[0] : null);
  if (!dir) {
    console.log('usage: node explorer/server.mjs --dir <assets folder> [--port 4848] [--thumbs <cache dir>]');
    process.exit(1);
  }
  startExplorer({ dir, port: Number(arg('port') || process.env.PORT || 4848), thumbs: arg('thumbs') })
    .catch((e) => { console.error(`  ${e.code === 'EADDRINUSE' ? `port in use, try --port ${Number(arg('port') || 4848) + 1}` : e.message}`); process.exit(1); });
}
