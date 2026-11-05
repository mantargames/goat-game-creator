// goat explorer front-end: packs, groups, lazy 3D thumbnails, a viewer with
// game-maker diagnostics (size in units, triangles, rig bones, missing textures).

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fileUrl = (rel) => '/files/' + rel.split('/').map(encodeURIComponent).join('/');
const fmtSize = (b) => (b >= 1 << 20 ? (b / (1 << 20)).toFixed(1) + ' MB' : Math.max(1, b >> 10) + ' KB');

let DB = { sections: [], packs: [], assets: [], root: '' };
const packById = new Map();
const assetsByPack = new Map();
const assetById = new Map();
const ui = { q: '', flt: new Set(), style: 'all', list: [] };

// ───────────────────────────────────────────── loading models

function loadModel(a) {
  const url = fileUrl(a.u);
  const problems = [];
  const manager = new THREE.LoadingManager();
  manager.onError = (u) => problems.push(decodeURIComponent(u.split('/').pop()));
  return new Promise((resolve, reject) => {
    const done = (scene, animations = []) => resolve({ scene, animations, problems });
    if (a.f === 'obj') {
      const finish = (materials) => {
        const loader = new OBJLoader(manager);
        if (materials) {
          materials.preload();
          // Blender/Kenney MTLs store linear colours, MTLLoader assumes sRGB: convert once
          for (const m of Object.values(materials.materials)) {
            if (m.color) m.color.convertLinearToSRGB();
            m.side = THREE.DoubleSide;
          }
          loader.setMaterials(materials);
        }
        loader.load(url, (o) => {
          o.traverse((c) => { if (c.isMesh && !materials) c.material = new THREE.MeshStandardMaterial({ color: 0xb8a888, side: THREE.DoubleSide }); });
          done(o);
        }, undefined, reject);
      };
      if (a.m) new MTLLoader(manager).load(fileUrl(a.m), finish, undefined, () => finish(null));
      else finish(null);
    } else if (a.f === 'fbx') {
      new FBXLoader(manager).load(url, (o) => done(o, o.animations || []), undefined, reject);
    } else {
      new GLTFLoader(manager).load(url, (g) => done(g.scene, g.animations || []), undefined, reject);
    }
  });
}

function frame(obj, camera, fit = 1.25) {
  const box = new THREE.Box3().setFromObject(obj);
  if (box.isEmpty()) return null;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const d = (maxDim / (2 * Math.tan((camera.fov * Math.PI) / 360))) * fit;
  camera.position.copy(center).addScaledVector(new THREE.Vector3(1, 0.7, 1.15).normalize(), d);
  camera.near = d / 100; camera.far = d * 100;
  camera.lookAt(center);
  camera.updateProjectionMatrix();
  return { box, size, center, d };
}

function dispose(obj) {
  obj.traverse((c) => {
    c.geometry?.dispose();
    for (const m of [].concat(c.material || [])) { for (const k in m) if (m[k]?.isTexture) m[k].dispose(); m.dispose(); }
  });
}

// ───────────────────────────────────────────── thumbnails (rendered once, cached by the server)

const TS = 256;
const tr = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
tr.setSize(TS, TS);
tr.toneMapping = THREE.ACESFilmicToneMapping;
const pmrem = new THREE.PMREMGenerator(tr);
const ENV = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const tScene = new THREE.Scene();
tScene.environment = ENV;
const key = new THREE.DirectionalLight(0xfff3e0, 1.6);
key.position.set(3, 5, 2);
tScene.add(key, new THREE.AmbientLight(0xffffff, 0.3));
const tCam = new THREE.PerspectiveCamera(30, 1, 0.01, 1000);
const queue = [];
let busy = 0;

function queueThumb(a, holder) { queue.push({ a, holder }); pump(); }
function pump() {
  while (busy < 2 && queue.length) {
    const job = queue.shift();
    if (!job.holder.isConnected) continue;
    busy++;
    renderThumb(job).finally(() => { busy--; pump(); });
  }
}
async function renderThumb({ a, holder }) {
  try {
    const { scene } = await loadModel(a);
    tScene.add(scene);
    if (!frame(scene, tCam, 1.15)) throw new Error('empty');
    tr.render(tScene, tCam);
    const data = tr.domElement.toDataURL('image/png');
    tScene.remove(scene);
    dispose(scene);
    setThumb(holder, data);
    fetch('/api/thumb', { method: 'POST', body: JSON.stringify({ id: a.id, data }) }).catch(() => {});
  } catch {
    holder.innerHTML = '<span class="err">no preview</span>';
  }
}
function setThumb(holder, src) {
  const tags = holder.querySelector('.tags');
  holder.innerHTML = `<img alt="" src="${src}">`;
  if (tags) holder.append(tags);
}

const seen = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    seen.unobserve(e.target);
    const a = e.target._asset;
    const holder = e.target.querySelector('.thumb');
    const img = new Image();
    img.onload = () => setThumb(holder, img.src);
    img.onerror = () => queueThumb(a, holder);
    img.src = `/thumbs/${a.id}.png`;
  }
}, { rootMargin: '300px' });

// ───────────────────────────────────────────── views

function tags(a) {
  const t = [];
  if (a.t) t.push('<span class="badge k">CHAR</span>');
  if (a.a) t.push('<span class="badge">ANIM</span>');
  if (a.v) t.push(`<span class="badge">${a.v.length}x</span>`);
  if (a.e) t.push('<span class="badge x">EXTRA</span>');
  return t.length ? `<div class="tags">${t.join('')}</div>` : '';
}

function card(a, showPack) {
  const b = document.createElement('button');
  b.className = 'card';
  b._asset = a;
  b.innerHTML = `<div class="thumb"><div class="spin"></div>${tags(a)}</div><div class="name">${esc(a.n)}<small>${showPack ? esc(packById.get(a.p)?.name) + ' / ' : ''}${a.f}</small></div>`;
  b.onclick = () => openViewer(a);
  seen.observe(b);
  return b;
}

const passes = (a) => {
  if (ui.flt.has('t') && !a.t) return false;
  if (ui.flt.has('a') && !a.a) return false;
  if (ui.flt.has('v') && !a.v) return false;
  if (ui.style !== 'all' && packById.get(a.p)?.style !== ui.style) return false;
  return true;
};

function renderHome() {
  const main = $('main');
  const packs = DB.packs.filter((p) => ui.style === 'all' || p.style === ui.style);
  main.innerHTML = `<div class="head"><h1>${DB.assets.length.toLocaleString()} models, ${DB.packs.length} packs</h1>
    <p class="mono">${esc(DB.rootLabel || DB.root)}</p></div>`;
  for (const s of DB.sections) {
    const list = packs.filter((p) => p.section === s.id);
    if (!list.length) continue;
    const sec = document.createElement('div');
    sec.className = 'section';
    sec.innerHTML = `<h2>${esc(s.name)}</h2><div class="blurb">${esc(s.blurb)}</div><div class="packs"></div>`;
    for (const p of list) {
      const first = (assetsByPack.get(p.id) || []).find((a) => !a.a);
      const cover = p.cover ? `<div class="cover" style="background-image:url('${fileUrl(p.cover)}')"></div>`
        : `<div class="cover"><img alt="" src="/thumbs/${first?.id}.png" onerror="this.remove()"></div>`;
      const el = document.createElement('a');
      el.className = 'pack';
      el.href = `#/pack/${p.id}`;
      el.innerHTML = `${cover}<div class="meta"><b>${esc(p.name)}</b><small>${p.count} models${p.chars ? ` · ${p.chars} chars` : ''}${p.anims ? ` · ${p.anims} anim files` : ''} · ${p.style}</small></div>`;
      sec.querySelector('.packs').append(el);
    }
    main.append(sec);
  }
  ui.list = [];
}

function renderPack(id) {
  const p = packById.get(id);
  if (!p) return renderHome();
  const list = (assetsByPack.get(id) || []).filter(passes);
  const main = $('main');
  main.innerHTML = `<div class="head"><h1>${esc(p.name)}</h1>
    <p>${p.count} models · ${p.files} files · ${fmtSize(p.bytes)} on disk</p>
    <div class="badges">${p.kaykit ? '<span class="badge k">KAYKIT</span>' : ''}<span class="badge">${p.style}</span>${p.editions.map((e) => `<span class="badge${e === 'EXTRA' ? ' x' : ''}">${e}</span>`).join('')}${p.dirs.map((d) => `<span class="badge mono">${esc(d || '.')}/</span>`).join('')}</div></div>
    <div class="chips">${p.groups.map((g, i) => `<a class="chip" href="javascript:void 0" data-g="${i}">${esc(g)}</a>`).join('')}</div>`;
  p.groups.forEach((g, i) => {
    const items = list.filter((a) => a.g === g);
    if (!items.length) return;
    const sec = document.createElement('div');
    sec.className = 'group';
    sec.id = `g${i}`;
    sec.innerHTML = `<h3>${esc(g)} <span class="mono">${items.length}</span></h3><div class="grid"></div>`;
    for (const a of items) sec.querySelector('.grid').append(card(a, false));
    main.append(sec);
  });
  main.querySelectorAll('.chip').forEach((c) => { c.onclick = () => $(`g${c.dataset.g}`)?.scrollIntoView({ behavior: 'smooth' }); });
  ui.list = list;
}

function renderSearch() {
  const words = ui.q.toLowerCase().split(/\s+/).filter(Boolean);
  const list = DB.assets.filter((a) => passes(a) && words.every((w) => `${a.n} ${packById.get(a.p)?.name} ${a.g}`.toLowerCase().includes(w)));
  const main = $('main');
  main.innerHTML = `<div class="head"><h1>${list.length} match${list.length === 1 ? '' : 'es'}</h1><p>for "${esc(ui.q || 'filters')}"${list.length > 600 ? ', showing 600' : ''}</p></div><div class="grid" style="margin-top:20px"></div>`;
  for (const a of list.slice(0, 600)) main.querySelector('.grid').append(card(a, true));
  ui.list = list;
}

function renderTree() {
  const tree = $('tree');
  tree.innerHTML = '';
  for (const s of DB.sections) {
    const list = DB.packs.filter((p) => p.section === s.id && (ui.style === 'all' || p.style === ui.style));
    if (!list.length) continue;
    tree.insertAdjacentHTML('beforeend', `<h4>${esc(s.name)}</h4>`);
    for (const p of list) tree.insertAdjacentHTML('beforeend', `<a href="#/pack/${p.id}" data-id="${p.id}"><span>${esc(p.name)}</span><span>${p.count}</span></a>`);
  }
}

function route() {
  const h = location.hash;
  const pack = h.match(/^#\/pack\/([^/]+)/);
  document.querySelectorAll('.tree a').forEach((a) => a.classList.toggle('on', pack && a.dataset.id === pack[1]));
  if (ui.q || (ui.flt.size && !pack)) renderSearch();
  else if (pack) renderPack(pack[1]);
  else renderHome();
  $('main').scrollTop = 0;
  const open = h.match(/\/a\/([a-z0-9]+)$/);
  if (open && assetById.get(open[1])) openViewer(assetById.get(open[1]));
}

// ───────────────────────────────────────────── viewer

let V = null;
function initViewer() {
  const canvas = $('mCanvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  const sun = new THREE.DirectionalLight(0xfff3e0, 1.5);
  sun.position.set(4, 8, 3);
  scene.add(sun, new THREE.AmbientLight(0xffffff, 0.25));
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 1000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.autoRotate = true;
  const grid = new THREE.GridHelper(10, 10, 0x6b6f7c, 0x3a3e4a);
  scene.add(grid);
  V = { renderer, scene, camera, controls, grid, model: null, mixer: null, clock: new THREE.Clock(), token: 0 };
  const loop = () => {
    if (!$('modal').hidden) {
      const r = canvas.getBoundingClientRect();
      if (canvas.width !== Math.floor(r.width * devicePixelRatio)) {
        renderer.setPixelRatio(devicePixelRatio);
        renderer.setSize(r.width, r.height, false);
        camera.aspect = r.width / r.height;
        camera.updateProjectionMatrix();
      }
      V.mixer?.update(V.clock.getDelta());
      controls.update();
      renderer.render(scene, camera);
    }
    requestAnimationFrame(loop);
  };
  loop();
}

async function openViewer(a, variant) {
  if (!V) initViewer();
  $('modal').hidden = false;
  V.current = a;
  const v = variant || a;
  const p = packById.get(a.p);
  $('mCrumb').textContent = `${p?.name || ''} / ${a.g}`;
  $('mTitle').textContent = a.n;
  $('mLoading').hidden = false;
  $('mClips').innerHTML = '';
  $('mNotes').innerHTML = '';
  $('mVariants').innerHTML = (a.v || []).map((x) => `<button data-id="${x.id}" class="${x.id === v.id ? 'on' : ''}">${esc(x.label)}</button>`).join('');
  $('mVariants').querySelectorAll('button').forEach((b) => { b.onclick = () => openViewer(a, a.v.find((x) => x.id === b.dataset.id)); });
  const base = (location.hash.replace(/\/a\/[a-z0-9]+$/, '') || '#/').replace(/\/$/, '');
  history.replaceState(null, '', `${base}/a/${a.id}`);
  const token = ++V.token;
  if (V.model) { V.scene.remove(V.model); dispose(V.model); V.model = null; V.mixer = null; }
  try {
    const { scene, animations, problems } = await loadModel({ ...a, ...v, m: v.m || a.m });
    if (token !== V.token) return dispose(scene);
    V.model = scene;
    V.scene.add(scene);
    const f = frame(scene, V.camera, 1.6);
    if (f) {
      V.controls.target.copy(f.center);
      const step = Math.pow(10, Math.floor(Math.log10(Math.max(f.size.x, f.size.z) || 1)));
      V.grid.scale.setScalar(step);
      V.grid.position.set(f.center.x, f.box.min.y, f.center.z);
    }
    describe(a, v, scene, f, animations, problems);
    if (animations.length) clips(scene, animations, `${animations.length} clips in this file`);
    else if (a.t) borrowClips(a, scene, token);
  } catch (e) {
    $('mNotes').innerHTML = `<div class="note bad">Could not load this file: ${esc(e.message || e)}</div>`;
  }
  $('mLoading').hidden = true;
}

function describe(a, v, scene, f, animations, problems) {
  let tris = 0, meshes = 0, skinned = false;
  const mats = new Set(), bones = [];
  scene.traverse((o) => {
    if (o.isMesh) {
      meshes++;
      const g = o.geometry;
      tris += g.index ? g.index.count / 3 : (g.attributes.position?.count || 0) / 3;
      for (const m of [].concat(o.material)) mats.add(m);
    }
    if (o.isSkinnedMesh) skinned = true;
    if (o.isBone) bones.push(o.name);
  });
  const s = f ? f.size : new THREE.Vector3();
  const rows = [
    ['file', `${v.u.split('/').pop()}`], ['format', v.f], ['size', fmtSize(v.s || a.s)],
    ['dimensions', `${s.x.toFixed(2)} x ${s.y.toFixed(2)} x ${s.z.toFixed(2)}`],
    ['triangles', Math.round(tris).toLocaleString()], ['meshes', meshes], ['materials', mats.size],
    ['rig', skinned ? `${bones.length} bones` : 'none'], ['clips', animations.length],
    ['path', v.u],
  ];
  $('mInfo').innerHTML = rows.map(([k, val]) => `<dt>${k}</dt><dd>${esc(val)}</dd>`).join('');
  const notes = [];
  const maxDim = Math.max(s.x, s.y, s.z);
  if (v.f === 'fbx' && maxDim > 30) notes.push(['bad', `About ${maxDim.toFixed(0)} units tall/wide: FBX in centimeters. Scale by 0.01 for meters.`]);
  else if (maxDim > 0) notes.push(['', `About ${maxDim.toFixed(2)} units at its largest. Compare sizes before mixing packs.`]);
  if (v.f === 'obj') notes.push(['', 'OBJ: material colours converted linear to sRGB and made double-sided (Kenney/Blender MTL).']);
  if (problems.length) notes.push(['bad', `Missing file(s): ${problems.slice(0, 3).join(', ')}. Usually a texture that is not next to the model, so it renders white.`]);
  const handslots = bones.filter((b) => /handslot/i.test(b));
  if (handslots.length) notes.push(['good', `Weapon bones: ${handslots.join(', ')}. Attach props to these.`]);
  if (a.t && !skinned) notes.push(['bad', 'Character with no skeleton: loose parts. Use as static decoration, it will not animate.']);
  $('mNotes').innerHTML = notes.map(([k, t]) => `<div class="note ${k}">${esc(t)}</div>`).join('');
}

function clips(model, list, label) {
  V.mixer = new THREE.AnimationMixer(model);
  const actions = [];
  const box = $('mClips');
  box.innerHTML = `<div class="label">${esc(label)}</div>`;
  const add = (name, fn) => { const b = document.createElement('button'); b.textContent = name; b.onclick = () => { box.querySelectorAll('button').forEach((x) => x.classList.remove('on')); b.classList.add('on'); fn(); }; box.append(b); return b; };
  add('bind pose', () => actions.forEach((x) => x.stop())).classList.add('on');
  for (const c of list.slice(0, 120)) {
    const act = V.mixer.clipAction(c);
    actions.push(act);
    add(c.name || 'clip', () => { actions.forEach((x) => x.stop()); act.reset().play(); });
  }
}

// KayKit characters share rigs with their pack's animation files (bones match by name)
async function borrowClips(a, model, token) {
  // KayKit rigs share bone names but not proportions: a Rig_Large clip explodes a Rig_Medium
  // character. The rig's root node is named Rig_Medium / Rig_Large, so only borrow matching files.
  let rig = null;
  model.traverse((o) => { const m = !rig && /^rig_([a-z]+)$/i.exec(o.name); if (m) rig = m[1].toLowerCase(); });
  const fits = (x) => !rig || new RegExp(`rig_${rig}`, 'i').test(x.u);
  const own = (assetsByPack.get(a.p) || []).filter((x) => x.a && fits(x));
  const shared = DB.assets.filter((x) => x.a && fits(x) && /animation/i.test(packById.get(x.p)?.name || ''));
  const sources = (own.length ? own : shared).slice(0, 10);
  if (!sources.length) return;
  $('mClips').innerHTML = '<div class="label">loading rig clips...</div>';
  const list = [];
  await Promise.all(sources.map(async (s) => { try { const r = await loadModel(s); dispose(r.scene); list.push(...r.animations); } catch {} }));
  if (token !== V.token || !list.length) { if (token === V.token) $('mClips').innerHTML = ''; return; }
  const unique = [...new Map(list.map((c) => [c.name, c])).values()]; // same clip ships in several files
  unique.sort((x, y) => (x.name || '').localeCompare(y.name || ''));
  clips(model, unique, `${unique.length} ${rig ? `Rig_${rig[0].toUpperCase() + rig.slice(1)} ` : ''}clips borrowed from ${own.length ? 'this pack' : 'an animation pack'}`);
}

function closeViewer() {
  $('modal').hidden = true;
  V.token++;
  history.replaceState(null, '', location.hash.replace(/\/a\/[a-z0-9]+$/, '') || '#/');
}
function nav(d) {
  if (!V?.current || !ui.list.length) return;
  const i = ui.list.indexOf(V.current);
  if (i < 0) return;
  openViewer(ui.list[(i + d + ui.list.length) % ui.list.length]);
}

function toast(t) { $('toast').textContent = t; $('toast').classList.add('show'); setTimeout(() => $('toast').classList.remove('show'), 1400); }

// ───────────────────────────────────────────── boot

$('mClose').onclick = closeViewer;
$('backdrop').onclick = closeViewer;
$('mPrev').onclick = () => nav(-1);
$('mNext').onclick = () => nav(1);
$('mSpin').onclick = (e) => { V.controls.autoRotate = !V.controls.autoRotate; e.target.classList.toggle('on'); };
$('mGrid').onclick = (e) => { V.grid.visible = !V.grid.visible; e.target.classList.toggle('on'); };
$('mWire').onclick = (e) => { const on = e.target.classList.toggle('on'); V.model?.traverse((o) => { for (const m of [].concat(o.material || [])) m.wireframe = on; }); };
$('mCopy').onclick = () => { const a = V.current; navigator.clipboard?.writeText(a.u).then(() => toast('path copied'), () => toast(a.u)); };
addEventListener('keydown', (e) => {
  if (e.key === '/' && document.activeElement !== $('search')) { e.preventDefault(); $('search').focus(); }
  if ($('modal').hidden) return;
  if (e.key === 'Escape') closeViewer();
  if (e.key === 'ArrowRight') nav(1);
  if (e.key === 'ArrowLeft') nav(-1);
});
let qTimer;
$('search').oninput = (e) => { clearTimeout(qTimer); qTimer = setTimeout(() => { ui.q = e.target.value.trim(); route(); }, 150); };
document.querySelectorAll('.flt').forEach((b) => { b.onclick = () => { b.classList.toggle('on'); ui.flt[b.classList.contains('on') ? 'add' : 'delete'](b.dataset.flt); route(); }; });
$('rescan').onclick = async () => { $('stat').textContent = 'rescanning...'; await fetch('/api/rescan', { method: 'POST' }); await load(); };
addEventListener('hashchange', () => { if (!/\/a\/[a-z0-9]+$/.test(location.hash)) route(); });

async function load() {
  DB = await (await fetch('/api/index')).json();
  packById.clear(); assetsByPack.clear(); assetById.clear();
  for (const p of DB.packs) packById.set(p.id, p);
  for (const a of DB.assets) {
    assetById.set(a.id, a);
    if (!assetsByPack.has(a.p)) assetsByPack.set(a.p, []);
    assetsByPack.get(a.p).push(a);
  }
  $('rootName').textContent = DB.rootLabel || DB.root;
  $('stat').textContent = `${DB.assets.length.toLocaleString()} models · ${DB.packs.length} packs`;
  const styles = ['all', ...new Set(DB.packs.map((p) => p.style))];
  $('styles').innerHTML = styles.length > 2 ? styles.map((s) => `<button class="sty${s === ui.style ? ' on' : ''}" data-s="${s}">${s}</button>`).join('') : '';
  $('styles').querySelectorAll('.sty').forEach((b) => { b.onclick = () => { ui.style = b.dataset.s; $('styles').querySelectorAll('.sty').forEach((x) => x.classList.toggle('on', x === b)); renderTree(); route(); }; });
  renderTree();
  route();
}
load();
