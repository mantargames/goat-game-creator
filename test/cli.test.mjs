// CLI + server smoke tests. No browser needed.
//   node test/cli.test.mjs
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(REPO, 'bin', 'goat-game.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'goat-game-test-'));
const run = (args, opts = {}) => execFileSync(process.execPath, [CLI, ...args], { cwd: tmp, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' }, ...opts });
const get = (port, p) => new Promise((resolve, reject) => {
  http.get({ host: '127.0.0.1', port, path: p }, (res) => {
    let body = '';
    res.on('data', (d) => { body += d; });
    res.on('end', () => resolve({ status: res.statusCode, body }));
  }).on('error', reject);
});
const waitFor = async (port, p) => {
  for (let i = 0; i < 50; i++) { try { return await get(port, p); } catch { await new Promise((r) => setTimeout(r, 100)); } }
  throw new Error('server did not start');
};

// a tiny valid glTF: one triangle, buffer inlined as a data URI
function writeGltf(file) {
  const pos = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  const b64 = Buffer.from(pos.buffer).toString('base64');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({
    asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    buffers: [{ byteLength: 36, uri: `data:application/octet-stream;base64,${b64}` }],
    bufferViews: [{ buffer: 0, byteLength: 36 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] }],
  }));
}

let passed = 0;
const t = async (name, fn) => { await fn(); passed++; console.log('  ok', name); };
const kids = [];

try {
  console.log('cli');
  await t('help lists every command', () => {
    const out = run(['--help']);
    for (const c of ['new', 'explore', 'shot', 'doctor']) assert.match(out, new RegExp(`goat-game ${c}`));
  });
  await t('unknown command exits 1', () => {
    assert.throws(() => run(['nope'], { stdio: 'pipe' }));
  });

  const assets = path.join(tmp, 'my-assets');
  writeGltf(path.join(assets, 'KayKit_Fake_Pack_1.0_FREE', 'Assets', 'gltf', 'hex_grass.gltf'));
  writeGltf(path.join(assets, 'KayKit_Fake_Pack_1.0_FREE', 'Assets', 'gltf', 'barrel_red.gltf'));
  writeGltf(path.join(assets, 'KayKit_Fake_Pack_1.0_FREE', 'Assets', 'gltf', 'barrel_blue.gltf'));
  writeGltf(path.join(assets, 'Other Pack', 'Models', 'rock.gltf'));

  await t('new copies the starter and writes the config', () => {
    run(['new', 'my-game', '--port', '6123', '--assets', assets]);
    const dir = path.join(tmp, 'my-game');
    for (const f of ['server.mjs', 'public/index.html', 'public/js/sim.js', 'public/js/rules.js', 'public/js/bot.js', 'scripts/shot.mjs', 'test/sim.test.mjs']) {
      assert.ok(fs.existsSync(path.join(dir, f)), f);
    }
    const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'game.config.json'), 'utf8'));
    assert.equal(cfg.port, 6123);
    assert.equal(cfg.assets, assets);
    assert.equal(cfg.name, 'My Game');
    assert.match(fs.readFileSync(path.join(dir, 'public/index.html'), 'utf8'), /<title>My Game<\/title>/);
  });
  await t('new refuses a non-empty folder without --force', () => {
    assert.throws(() => run(['new', 'my-game'], { stdio: 'pipe' }));
  });
  await t("the new game's sim tests pass", () => {
    execFileSync(process.execPath, ['test/sim.test.mjs'], { cwd: path.join(tmp, 'my-game'), stdio: 'pipe' });
  });

  await t('game server serves the game, lists models, guards /files', async () => {
    const port = 20000 + Math.floor(Math.random() * 20000);
    const kid = spawn(process.execPath, ['server.mjs', '--port', String(port)], { cwd: path.join(tmp, 'my-game'), stdio: 'ignore' });
    kids.push(kid);
    const home = await waitFor(port, '/');
    assert.equal(home.status, 200);
    assert.match(home.body, /importmap/);
    const models = JSON.parse((await get(port, '/api/models')).body).models;
    assert.ok(models.some((m) => m.endsWith('hex_grass.gltf')));
    assert.equal((await get(port, '/files/Other%20Pack/Models/rock.gltf')).status, 200);
    assert.equal((await get(port, '/files/..%2Fmy-game%2Fgame.config.json')).status, 403);
    kid.kill();
  });

  await t('explorer indexes a folder: packs, colour variants, KayKit flag', async () => {
    const { buildIndex } = await import('../explorer/indexer.mjs');
    const ix = buildIndex(assets);
    assert.equal(ix.packs.length, 2);
    const kk = ix.packs.find((p) => p.kaykit);
    assert.ok(kk, 'KayKit pack detected');
    assert.equal(kk.name, 'Fake Pack 1.0');
    const barrel = ix.assets.find((a) => a.n === 'barrel');
    assert.equal(barrel.v.length, 2, 'red + blue collapse into one card');
  });

  await t('explorer server: index, files, traversal guard', async () => {
    const { startExplorer } = await import('../explorer/server.mjs');
    const server = await startExplorer({ dir: assets, port: 0, quiet: true, thumbs: path.join(tmp, 'thumbs') });
    const port = server.address().port;
    const ix = JSON.parse((await get(port, '/api/index')).body);
    assert.equal(ix.assets.length, 3);
    assert.equal((await get(port, '/')).status, 200);
    assert.equal((await get(port, '/files/Other%20Pack/Models/rock.gltf')).status, 200);
    assert.equal((await get(port, '/files/..%2Fmy-game%2Fgame.config.json')).status, 403);
    assert.equal((await get(port, '/thumbs/abc.png')).status, 204);
    server.close();
  });

  await t('doctor runs and finds the KayKit tile', () => {
    let out;
    try { out = run(['doctor', '--assets', assets], { stdio: 'pipe' }); } catch (e) { out = e.stdout; }
    assert.match(out, /node /);
    assert.match(out, /KayKit Medieval Hexagon found/);
  });

  console.log(`\n${passed} passed`);
} finally {
  for (const k of kids) k.kill();
  fs.rmSync(tmp, { recursive: true, force: true });
}
