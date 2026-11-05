// Asset manifest + loader with a graceful fallback.
//
// MODELS maps a logical name to a file name (not a path). The server lists every
// model in your asset folder (/api/models) and we pick the first path that ends
// with that file name, preferring paths that match PREFER. So it does not matter
// where you unzipped the pack. If a file is missing, makeModel() returns a
// coloured primitive instead, so the game always runs.
//
// Defaults target KayKit Medieval Hexagon (FREE): https://kaylousberg.itch.io

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HEX_R } from './hex.js';

export const PREFER = /hexagon/i;

export const MODELS = {
  tile: 'hex_grass.gltf',
  forest_a: 'trees_A_medium.gltf', forest_b: 'trees_B_medium.gltf', forest_c: 'trees_A_large.gltf',
  hills_a: 'hills_A.gltf', hills_b: 'hills_B_trees.gltf', hills_c: 'hills_C.gltf',
  tree: 'tree_single_A.gltf', rock: 'rock_single_A.gltf',
  townhall: 'building_castle_blue.gltf',
  lumbermill: 'building_lumbermill_blue.gltf',
  house_a: 'building_home_A_blue.gltf', house_b: 'building_home_B_blue.gltf',
  tower: 'building_tower_A_blue.gltf',
  flag: 'flag_blue.gltf',
};

// per-model scale tweaks (KayKit buildings are ~1 unit tall, the castle ~4)
export const SCALE = { townhall: 0.55 };
// per-model colour multipliers (the stock KayKit grass reads lime under ACES tone mapping)
export const TINT = { tile: [0.7, 1.0, 0.52] };

const loaded = {};
export const report = { found: [], missing: [], failed: [] };

export async function loadAll(onProgress) {
  let list = [];
  if (!new URLSearchParams(location.search).has('noassets')) {
    try { list = (await (await fetch('/api/models')).json()).models; } catch {}
  }
  const pick = (file) => {
    const hits = list.filter((p) => p.toLowerCase().endsWith('/' + file.toLowerCase()) || p.toLowerCase() === file.toLowerCase());
    return hits.find((p) => PREFER.test(p)) || hits[0];
  };
  const loader = new GLTFLoader();
  const entries = Object.entries(MODELS);
  let done = 0;
  await Promise.all(entries.map(async ([name, file]) => {
    const p = pick(file);
    if (!p) { report.missing.push(name); onProgress?.(++done / entries.length); return; }
    const url = '/files/' + p.split('/').map(encodeURIComponent).join('/');
    try {
      const g = await loader.loadAsync(url);
      g.scene.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true; o.receiveShadow = true;
        if (TINT[name]) { o.material = o.material.clone(); o.material.color.multiply(new THREE.Color(...TINT[name])); }
      });
      loaded[name] = g.scene;
      report.found.push(name);
    } catch {
      report.failed.push(name);
    }
    onProgress?.(++done / entries.length);
  }));
  return report;
}

export const has = (name) => !!loaded[name];

export function makeModel(name) {
  const src = loaded[name];
  const obj = src ? src.clone() : fallback(name);
  if (SCALE[name] && src) obj.scale.setScalar(SCALE[name]);
  return obj;
}

// ───────────────────────────────────────── coloured primitives (no assets needed)

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...extra });
const mesh = (geo, m, y = 0, x = 0, z = 0) => {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  o.castShadow = true; o.receiveShadow = true;
  return o;
};

function fallback(name) {
  const g = new THREE.Group();
  const base = name.replace(/_[abc]$/, '');
  if (base === 'tile') {
    // a 6-sided cylinder already has its corners on +z: pointy-top, like the KayKit tiles
    g.add(mesh(new THREE.CylinderGeometry(HEX_R * 0.98, HEX_R * 0.98, 1, 6), mat(0x7cbf5a), -0.5));
  } else if (base === 'forest') {
    for (const [x, z, s] of [[-0.4, -0.2, 1], [0.35, -0.3, 0.8], [0, 0.4, 0.9]]) {
      g.add(mesh(new THREE.ConeGeometry(0.35 * s, 1.1 * s, 7), mat(0x2f7a3a), 0.55 * s + 0.15, x, z));
      g.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3), mat(0x6b4a2b), 0.15, x, z));
    }
  } else if (base === 'hills') {
    const h = mesh(new THREE.SphereGeometry(0.75, 7, 5, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x9a8a5a));
    h.scale.y = 0.6;
    g.add(h);
  } else if (name === 'tree') {
    g.add(mesh(new THREE.ConeGeometry(0.25, 0.8, 7), mat(0x3d8b45), 0.55));
    g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.2), mat(0x6b4a2b), 0.1));
  } else if (name === 'rock') {
    g.add(mesh(new THREE.DodecahedronGeometry(0.2), mat(0x8a8f96), 0.12));
  } else if (name === 'townhall') {
    g.add(mesh(new THREE.BoxGeometry(1.2, 0.9, 1.2), mat(0xd9cbb0), 0.45));
    for (const [x, z] of [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]]) {
      g.add(mesh(new THREE.CylinderGeometry(0.2, 0.22, 1.4, 8), mat(0xcdbd9e), 0.7, x, z));
      g.add(mesh(new THREE.ConeGeometry(0.28, 0.45, 8), mat(0x3b6fd1), 1.62, x, z));
    }
  } else if (base === 'house') {
    g.add(mesh(new THREE.BoxGeometry(0.7, 0.5, 0.6), mat(0xe6dcc6), 0.25));
    const roof = mesh(new THREE.ConeGeometry(0.58, 0.45, 4), mat(0x3b6fd1), 0.72);
    roof.rotation.y = Math.PI / 4;
    g.add(roof);
  } else if (name === 'lumbermill') {
    g.add(mesh(new THREE.BoxGeometry(0.9, 0.55, 0.6), mat(0x9a6b3e), 0.28));
    g.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.9, 8), mat(0x7a5530), 0.12, 0, 0.5).rotateZ(Math.PI / 2));
  } else if (name === 'tower') {
    g.add(mesh(new THREE.CylinderGeometry(0.32, 0.4, 1.5, 8), mat(0xb9b2a5), 0.75));
    g.add(mesh(new THREE.ConeGeometry(0.42, 0.5, 8), mat(0x3b6fd1), 1.75));
  } else if (name === 'flag') {
    g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8), mat(0x6b4a2b), 0.4));
    g.add(mesh(new THREE.BoxGeometry(0.3, 0.18, 0.02), mat(0x3b6fd1), 0.7, 0.15));
  } else {
    g.add(mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), mat(0xff00ff), 0.25)); // loud on purpose: unknown name
  }
  return g;
}
