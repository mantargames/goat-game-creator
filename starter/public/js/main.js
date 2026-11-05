// Render + input + HUD. Reads the sim state, never decides game rules itself.
//
// Debug hooks (build these into every game from day one):
//   ?seed=7          reproducible island
//   ?sim=3           bot plays 3 days + nights synchronously, prints one line to #debuglog
//   ?autoplay        bot plays the whole game on screen (?speed=4 to fast-forward)
//   ?gallery         every model from the manifest in a row, with a found/missing report
//   ?night=6         start the night right away and pre-run 6 sim seconds (combat screenshots)
//   ?noassets        ignore the asset folder and use coloured primitives
//   ?r.START.gold=99 override any number in rules.js

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RULES, applyOverrides } from './rules.js';
import { toWorld, HEX_R } from './hex.js';
import * as S from './sim.js';
import { playDay } from './bot.js';
import { loadAll, makeModel, MODELS, report } from './assets.js';

const params = new URLSearchParams(location.search);
applyOverrides(location.search);
const SPEED = Number(params.get('speed') || 1);
const $ = (id) => document.getElementById(id);
const log = (line) => { $('debuglog').textContent += line + '\n'; console.log(line); };

// ───────────────────────────────────────────── three.js scene

const renderer = new THREE.WebGLRenderer({ canvas: $('scene'), antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const DAY_SKY = new THREE.Color(0x8fd3f0), NIGHT_SKY = new THREE.Color(0x1d2347);
const SUN_DAY = new THREE.Color(0xfff1d6), SUN_NIGHT = new THREE.Color(0x8fa6ff);
scene.background = DAY_SKY.clone();
scene.fog = new THREE.Fog(scene.background, 30, 70);

const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
camera.position.set(0, 19, 17);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 1.6);
controls.enableDamping = true;
controls.maxPolarAngle = 1.2;
controls.minDistance = 8;
controls.maxDistance = 35;
controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.PAN };

const hemi = new THREE.HemisphereLight(0xdff3ff, 0x5d7a3a, 1.1);
const sun = new THREE.DirectionalLight(0xfff1d6, 2.4);
sun.position.set(-10, 16, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 50 });
sun.shadow.bias = -0.0005;
scene.add(hemi, sun);

// ocean: a plane plus a lighter lagoon disk under the island
const sea = new THREE.Mesh(new THREE.CircleGeometry(120, 48), new THREE.MeshStandardMaterial({ color: 0x2f8fc0, roughness: 0.35, metalness: 0.05 }));
sea.rotation.x = -Math.PI / 2; sea.position.y = -0.45; sea.receiveShadow = true;
// soft-edged lagoon: a radial gradient texture fades the turquoise into the deep sea
const grad = document.createElement('canvas');
grad.width = grad.height = 256;
const gctx = grad.getContext('2d');
const rg = gctx.createRadialGradient(128, 128, 60, 128, 128, 128);
rg.addColorStop(0, '#fff'); rg.addColorStop(1, '#000'); // alphaMap reads brightness, not alpha
gctx.fillStyle = rg; gctx.fillRect(0, 0, 256, 256);
const lagoon = new THREE.Mesh(new THREE.CircleGeometry(RULES.MAP_RADIUS * 2 + 5, 48),
  new THREE.MeshStandardMaterial({ color: 0x6fe0dc, roughness: 0.3, transparent: true, alphaMap: new THREE.CanvasTexture(grad), depthWrite: false }));
lagoon.rotation.x = -Math.PI / 2; lagoon.position.y = -0.43;
scene.add(sea, lagoon);

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ───────────────────────────────────────────── world objects

const world = new THREE.Group();
scene.add(world);
const tileObjs = new Map();     // "q,r" → group (raycast targets)
const buildingObjs = new Map(); // building id → group
const enemyObjs = new Map();    // enemy id → mesh
const fx = [];                  // short-lived effects: { obj, t, life, update }

const variant = (t, list) => list[t.v % list.length];

function makeTile(t) {
  const g = new THREE.Group();
  const w = toWorld(t.q, t.r);
  g.position.set(w.x, 0, w.z);
  g.add(makeModel('tile'));
  if (t.t === 'forest') g.add(makeModel(variant(t, ['forest_a', 'forest_b', 'forest_c'])));
  if (t.t === 'hills') g.add(makeModel(variant(t, ['hills_a', 'hills_b', 'hills_c'])));
  if (t.t === 'meadow' && t.v === 2 && (t.q || t.r)) {
    const d = makeModel((t.q + t.r) & 1 ? 'tree' : 'rock');
    d.position.set(0.6, 0, 0.35);
    g.add(d);
  }
  g.userData.tile = t;
  return g;
}

function makeBuilding(b) {
  const g = new THREE.Group();
  const w = toWorld(b.q, b.r);
  g.position.set(w.x, 0, w.z);
  const name = b.type === 'house' ? (b.id & 1 ? 'house_a' : 'house_b') : b.type;
  g.add(makeModel(name));
  if (b.type === 'townhall') { const f = makeModel('flag'); f.position.set(0.7, 0, 0.6); g.add(f); }
  g.userData.building = b;
  return g;
}

function buildWorld() {
  world.clear();
  tileObjs.clear(); buildingObjs.clear(); enemyObjs.clear();
  for (const t of Object.values(state.tiles)) {
    const o = makeTile(t);
    tileObjs.set(`${t.q},${t.r}`, o);
    world.add(o);
  }
  for (const b of Object.values(state.buildings)) addBuilding(b, false);
}

function addBuilding(b, pop = true) {
  const o = makeBuilding(b);
  buildingObjs.set(b.id, o);
  world.add(o);
  if (pop) popIn(o);
}

// juice: buildings pop in with an overshoot
function popIn(o) {
  o.scale.setScalar(0.01);
  fx.push({ obj: o, t: 0, life: 0.35, update: (k) => o.scale.setScalar(Math.max(0.01, 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2)) });
}

function puff(x, z, color = 0xffffff) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 }));
  m.position.set(x, 0.4, z);
  world.add(m);
  fx.push({ obj: m, t: 0, life: 0.5, update: (k) => { m.scale.setScalar(1 + k * 2); m.material.opacity = 0.8 * (1 - k); }, done: () => world.remove(m) });
}

const ENEMY_GEO = new THREE.IcosahedronGeometry(0.28, 0);
const ENEMY_MAT = new THREE.MeshStandardMaterial({ color: 0x6b3fa0, roughness: 0.6, flatShading: true, emissive: 0x2a0f45 });
const EYE_MAT = new THREE.MeshBasicMaterial({ color: 0xfff27a });
function makeEnemy() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(ENEMY_GEO, ENEMY_MAT);
  body.position.y = 0.32; body.castShadow = true;
  for (const x of [-0.1, 0.1]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), EYE_MAT); eye.position.set(x, 0.4, 0.22); g.add(eye); }
  g.add(body);
  return g;
}

function shot(fromId, toId) {
  const b = buildingObjs.get(fromId), e = enemyObjs.get(toId);
  if (!b || !e) return;
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffe08a }));
  const from = b.position.clone().setY(1.6), to = e.position.clone().setY(0.35);
  world.add(m);
  fx.push({ obj: m, t: 0, life: 0.18, update: (k) => { m.position.lerpVectors(from, to, k); m.position.y += Math.sin(k * Math.PI) * 0.6; }, done: () => world.remove(m) });
}

// ───────────────────────────────────────────── hover + picking

const hover = new THREE.Mesh(
  new THREE.RingGeometry(HEX_R * 0.78, HEX_R * 0.95, 6, 1),
  new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthTest: false }),
);
hover.geometry.rotateZ(Math.PI / 6); // corners on z: pointy-top like the tiles
hover.rotation.x = -Math.PI / 2; hover.position.y = 0.04; hover.renderOrder = 5;
hover.visible = false;
scene.add(hover);

const ray = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hovered = null;
let selected = 'house';

function pick(ev) {
  mouse.set((ev.clientX / innerWidth) * 2 - 1, -(ev.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(mouse, camera);
  const hit = ray.intersectObjects([...tileObjs.values()], true)[0];
  if (!hit) return null;
  let o = hit.object;
  while (o && !o.userData.tile) o = o.parent;
  return o ? o.userData.tile : null;
}

renderer.domElement.addEventListener('pointermove', (ev) => {
  hovered = state.phase === 'day' ? pick(ev) : null;
  hover.visible = !!hovered;
  if (!hovered) return;
  const w = toWorld(hovered.q, hovered.r);
  hover.position.set(w.x, 0.04, w.z);
  hover.material.color.set(S.canBuild(state, selected, hovered.q, hovered.r).ok ? 0x9cff7a : 0xff6b6b);
});
renderer.domElement.addEventListener('pointerdown', (ev) => {
  if (ev.button !== 0 || state.phase !== 'day') return;
  const t = pick(ev);
  if (!t) return;
  const res = S.build(state, selected, t.q, t.r);
  if (!res.ok) toast(res.err);
  drain();
  hud();
});

// ───────────────────────────────────────────── HUD

let toastTimer = 0;
function toast(text) {
  $('toast').textContent = text;
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), 1600);
}

const costText = (c) => Object.entries(c).map(([k, v]) => `${v} ${k}`).join(' + ') || 'free';
function buildBar() {
  $('buildBar').innerHTML = '';
  for (const [type, def] of Object.entries(RULES.BUILDINGS)) {
    if (type === 'townhall') continue;
    const b = document.createElement('button');
    b.className = 'bcard';
    b.dataset.type = type;
    b.innerHTML = `<div class="name">${def.label}</div><div class="cost">${costText(def.cost)}</div><div class="desc">${def.desc}</div>`;
    b.onclick = () => { selected = type; hud(); };
    $('buildBar').append(b);
  }
}

function hud() {
  $('gold').textContent = state.res.gold;
  $('wood').textContent = state.res.wood;
  const night = state.phase === 'night';
  $('phase').textContent = night ? `Night ${state.night + 1}: ${state.enemies.length + state.spawnLeft} enemies` : `Day ${state.night + 1} of ${RULES.NIGHTS_TO_WIN}`;
  $('phase').classList.toggle('night', night);
  const inc = S.income(state);
  $('income').textContent = `at dawn: +${inc.gold} gold, +${inc.wood} wood`;
  $('nightBtn').disabled = state.phase !== 'day';
  for (const b of $('buildBar').children) {
    b.classList.toggle('on', b.dataset.type === selected);
    b.classList.toggle('poor', !S.canAfford(state, RULES.BUILDINGS[b.dataset.type].cost));
  }
}

$('nightBtn').onclick = () => { S.startNight(state); drain(); hud(); };
$('restart').onclick = () => { newGame(); };
addEventListener('keydown', (e) => {
  if (e.code === 'Space') $('nightBtn').click();
  const types = Object.keys(RULES.BUILDINGS).filter((t) => t !== 'townhall');
  const n = Number(e.key);
  if (n >= 1 && n <= types.length) { selected = types[n - 1]; hud(); }
});

// ───────────────────────────────────────────── game loop

let state;
function newGame() {
  state = S.newGame({ seed: Number(params.get('seed') || Math.floor(Math.random() * 1e6)) });
  // ?sim=N: the bot plays N days and nights instantly, then we render the result
  const simN = Number(params.get('sim') || 0);
  for (let i = 0; i < simN && state.phase === 'day'; i++) { playDay(state); S.runNight(state); }
  state.events.length = 0;
  if (simN) log(`sim ${simN}: ${S.summary(state)}`);
  buildWorld();
  $('end').hidden = true;
  if (params.has('night') && state.phase === 'day') {
    // headless capture barely advances the live clock, so pre-run the sim to mid-battle
    S.startNight(state);
    const secs = Number(params.get('night') || 0);
    for (let t = 0; t < secs && state.phase === 'night'; t += RULES.STEP) S.step(state, RULES.STEP);
    state.events = state.events.filter((e) => e.type !== 'shot');
    drain();
    nightLight = state.phase === 'night' ? 1 : 0;
  }
  hud();
}

// apply sim events to the scene (the only place the view reacts to game logic)
function drain() {
  for (const ev of state.events) {
    if (ev.type === 'built') addBuilding(state.buildings[ev.id]);
    if (ev.type === 'spawn') {
      const e = state.enemies.find((x) => x.id === ev.id);
      if (!e) continue;
      const o = makeEnemy();
      o.position.set(e.x, 0, e.z);
      enemyObjs.set(ev.id, o); world.add(o); popIn(o);
    }
    if (ev.type === 'shot') shot(ev.from, ev.to);
    if (ev.type === 'killed') { const o = enemyObjs.get(ev.id); if (o) { puff(o.position.x, o.position.z, 0xc9a6ff); world.remove(o); enemyObjs.delete(ev.id); } }
    if (ev.type === 'destroyed') { const o = buildingObjs.get(ev.id); if (o) { puff(o.position.x, o.position.z, 0x888888); world.remove(o); buildingObjs.delete(ev.id); } }
    if (ev.type === 'night') toast(`Night ${ev.night}: ${ev.enemies} enemies are coming`);
    if (ev.type === 'dawn') { for (const o of enemyObjs.values()) world.remove(o); enemyObjs.clear(); toast(`Dawn: +${ev.income.gold} gold, +${ev.income.wood} wood`); }
    if (ev.type === 'won' || ev.type === 'lost') {
      $('endTitle').textContent = ev.type === 'won' ? 'Victory!' : 'The hall has fallen';
      $('endText').textContent = `You survived ${state.night} of ${RULES.NIGHTS_TO_WIN} nights.`;
      $('end').hidden = false;
      log(`end: ${S.summary(state)}`);
    }
  }
  state.events.length = 0;
}

let acc = 0, nightLight = 0, autoTimer = 0, last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  // fixed-step simulation: the same steps the tests run
  if (state.phase === 'night') {
    acc += dt * SPEED;
    while (acc >= RULES.STEP && state.phase === 'night') { S.step(state, RULES.STEP); acc -= RULES.STEP; }
    drain();
    hud();
  }
  if (params.has('autoplay') && state.phase === 'day') {
    autoTimer += dt * SPEED;
    if (autoTimer > 1.2) { autoTimer = 0; playDay(state); drain(); S.startNight(state); drain(); hud(); }
  }

  // enemies glide to their sim positions and bob
  for (const e of state.enemies) {
    const o = enemyObjs.get(e.id);
    if (!o) continue;
    const prev = o.position.clone();
    o.position.x += (e.x - o.position.x) * Math.min(1, dt * 12);
    o.position.z += (e.z - o.position.z) * Math.min(1, dt * 12);
    o.position.y = Math.abs(Math.sin(now / 140 + e.id)) * 0.12;
    if (prev.distanceToSquared(o.position) > 1e-6) o.lookAt(o.position.x + (o.position.x - prev.x), o.position.y, o.position.z + (o.position.z - prev.z));
  }

  // day/night lighting blend
  const target = state.phase === 'night' ? 1 : 0;
  nightLight += (target - nightLight) * Math.min(1, dt * 2);
  scene.background.lerpColors(DAY_SKY, NIGHT_SKY, nightLight);
  scene.fog.color.copy(scene.background);
  sun.intensity = 2.4 - 1.9 * nightLight;
  sun.color.lerpColors(SUN_DAY, SUN_NIGHT, nightLight);
  hemi.intensity = 1.1 - 0.6 * nightLight;

  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i];
    f.t += dt;
    const k = Math.min(1, f.t / f.life);
    f.update(k);
    if (k >= 1) { f.done?.(); fx.splice(i, 1); }
  }

  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ───────────────────────────────────────────── gallery

function gallery() {
  const names = Object.keys(MODELS);
  const labels = [];
  names.forEach((name, i) => {
    const o = makeModel(name);
    o.position.set((i % 5) * 3.4 - 6.8, 0, Math.floor(i / 5) * 3.6 - 3.6);
    scene.add(o);
    const el = document.createElement('div');
    el.className = 'label' + (report.found.includes(name) ? '' : ' missing');
    el.textContent = name;
    document.body.append(el);
    labels.push([o, el]);
  });
  camera.position.set(0, 13, 15);
  controls.target.set(0, 0, 0.5);
  controls.update();
  const place = () => {
    for (const [o, el] of labels) {
      const p = o.position.clone().setY(-0.2).project(camera);
      el.style.left = `${(p.x + 1) / 2 * innerWidth}px`;
      el.style.top = `${(1 - p.y) / 2 * innerHeight}px`;
    }
    requestAnimationFrame(place);
  };
  place();
  log(`gallery: ${report.found.length} loaded, ${report.missing.length} missing [${report.missing.join(' ')}], ${report.failed.length} failed [${report.failed.join(' ')}]`);
}

// ───────────────────────────────────────────── boot

(async () => {
  await loadAll((p) => { $('loadText').textContent = `loading assets... ${Math.round(p * 100)}%`; });
  $('loading').hidden = true;
  if (report.missing.length) console.warn('missing models, using primitives:', report.missing.join(', '));
  state = S.newGame({ seed: 1 });
  if (params.has('gallery')) { sea.visible = lagoon.visible = false; gallery(); }
  else { buildBar(); newGame(); $('hud').hidden = false; }
  window.GAME = { get state() { return state; }, S, RULES, scene, camera, report };
  log(`ready: models ${report.found.length}/${Object.keys(MODELS).length}`);
  requestAnimationFrame(frame);
})();
