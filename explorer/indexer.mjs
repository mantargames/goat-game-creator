// Asset index for any folder of 3D packs (glb, gltf, obj, fbx).
//
// How a folder becomes packs:
//   root/<Pack>/...                    each top-level folder is a pack
//   root/<Category>/<Pack>/...         a top-level folder full of packs is a category
// Editions of one pack (FREE / EXTRA / EA, "Block Bits" vs "BlockBits") merge into one.
// The same model in several formats is listed once (glb > gltf > obj > fbx).
// Colour variants (_Color1, _red, colour subfolders) collapse into one card.
// KayKit-aware: packs from KayKit get themed sections, character/animation flags,
// and the viewer can borrow rig animations for characters.

import fs from 'node:fs';
import path from 'node:path';

export function hashId(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

const MODEL_RE = /\.(glb|gltf|obj|fbx)$/i;
const RANK = { '.glb': 4, '.gltf': 3, '.obj': 2, '.fbx': 1 };
const SKIP_DIR = /^(\.|__MACOSX$|node_modules$|\.git$)/;
// folder names that describe file layout, not content
const NOISE_DIR = /^(kaykit.*|assets?|models?|gltf|glb|obj|fbx.*|dae|textures?|source|samples?|previews?|.*format|individual|animations?|characters?|props?|buildings?|environment|tiles?|decorations?|units?|meshes|export(s)?|blend(er)?|unity|unreal|godot)$/i;
const COLOR_WORDS = 'red|blue|green|yellow|white|brown|black|neutral|purple|orange|pink|gray|grey|teal|gold|silver';
const VARIANT_RE = new RegExp(`_(color\\d+|${COLOR_WORDS})$`, 'i');
const COLOR_DIR_RE = new RegExp(`^(color\\d+|${COLOR_WORDS})$`, 'i');
// FBX files named like animation clips are poses, not models
const ANIM_CLIP = /\b(attack|idle|walk|run|turn|hit|death|die|jump|pose|sprint|trot|gallop|crouch|reload|react|aim|fire)\b/i;
const IMG_COVER = /^(contents|artwork|overview|preview|cover|thumbnail|screenshot)[^/]*\.(png|jpe?g|webp)$/i;
const IMG_SAMPLE = /sample[^/]*\.(png|jpe?g)$/i;

const KAYKIT_SECTIONS = [
  { id: 'characters', name: 'Characters', blurb: 'Rigged heroes, monsters and NPCs' },
  { id: 'fantasy', name: 'Fantasy & Dungeon', blurb: 'Dungeons, hex maps, weapons, RPG tools' },
  { id: 'nature', name: 'Nature & Resources', blurb: 'Trees, rocks, plants, resource piles' },
  { id: 'town', name: 'Town & Interiors', blurb: 'City blocks, furniture, restaurants' },
  { id: 'seasonal', name: 'Seasonal', blurb: 'Halloween and holiday props' },
  { id: 'gamekits', name: 'Game Kits & Prototyping', blurb: 'Platformer, blocks, board games, greybox' },
  { id: 'scifi', name: 'Sci-Fi', blurb: 'Space bases and stations' },
  { id: 'animations', name: 'Animations', blurb: 'Shared-rig clip libraries' },
];

function kaykitSection(key, hasChars) {
  if (/animation/.test(key)) return 'animations';
  if (hasChars && /adventurer|skeleton|character|mannequin|farmer/.test(key)) return 'characters';
  if (/dungeon|fantasyweapon|rpgtool|medievalhex|hexagon/.test(key)) return 'fantasy';
  if (/forest|resource|nature/.test(key)) return 'nature';
  if (/city|furniture|restaurant/.test(key)) return 'town';
  if (/halloween|holiday/.test(key)) return 'seasonal';
  if (/space/.test(key)) return 'scifi';
  if (hasChars) return 'characters';
  return 'gamekits';
}

function styleOf(rel) {
  const s = rel.toLowerCase();
  if (/kaykit/.test(s)) return 'kaykit';
  if (/quaternius/.test(s)) return 'quaternius';
  if (/kenney/.test(s)) return /blocky|cube pets|brick kit|mini /.test(s) ? 'blocky' : 'kenney';
  if (/synty|polygon/.test(s)) return 'synty';
  return 'other';
}

// "KayKit_Adventurers_2.0_EXTRA" → "Adventurers 2.0"
function familyName(dir) {
  return dir
    .replace(/[_-]+/g, ' ')
    .replace(/\b(KayKit|EXTRA|FREE|EA|GLB|Patreon|Early Access|Standard)\b/gi, '')
    .replace(/\s+/g, ' ').trim()
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ') || dir;
}
const familyKey = (dir) => familyName(dir).toLowerCase().replace(/[^a-z0-9]/g, '');

function editionOf(rel) {
  if (/[_ ]EXTRA(\/|$|_)/.test(rel)) return 'EXTRA';
  if (/patreon|early.?access|(^|\/)[^/]* EA(\/|$)/i.test(rel)) return 'EA';
  return 'FREE';
}

function walk(dir, out, depth = 0) {
  if (depth > 14) return;
  let names;
  try { names = fs.readdirSync(dir); } catch { return; }
  for (const name of names) {
    if (SKIP_DIR.test(name)) continue;
    const full = path.join(dir, name);
    let st;
    try { st = fs.statSync(full); } catch { continue; }
    if (st.isDirectory()) walk(full, out, depth + 1);
    else out.push({ full, size: st.size, mtime: st.mtimeMs });
  }
}

const pretty = (s) => s.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const posix = (p) => p.split(path.sep).join('/');

export function buildIndex(ROOT) {
  ROOT = path.resolve(ROOT);
  const files = [];
  walk(ROOT, files);
  const rels = files.map((f) => ({ ...f, rel: posix(path.relative(ROOT, f.full)) }));

  // how many models live under each folder
  const modelsUnder = new Map();
  for (const f of rels) {
    if (!MODEL_RE.test(f.rel)) continue;
    const segs = f.rel.split('/');
    for (let i = 1; i < segs.length; i++) {
      const d = segs.slice(0, i).join('/');
      modelsUnder.set(d, (modelsUnder.get(d) || 0) + 1);
    }
  }
  const childDirs = (d) => {
    const out = new Set();
    const prefix = d ? d + '/' : '';
    for (const k of modelsUnder.keys()) {
      if (!k.startsWith(prefix)) continue;
      const rest = k.slice(prefix.length);
      if (rest && !rest.includes('/')) out.add(rest);
    }
    return [...out];
  };
  const hasDirectModels = (d) => rels.some((f) => MODEL_RE.test(f.rel) && path.posix.dirname(f.rel) === d);
  const isCategory = (d) => {
    if (hasDirectModels(d)) return false;
    const kids = childDirs(d);
    if (kids.length < 2) return false;
    const meaningful = kids.filter((k) => !NOISE_DIR.test(k) && !COLOR_DIR_RE.test(k));
    if (meaningful.length / kids.length < 0.6) return false;
    // FREE/EXTRA editions of one pack are a pack, not a category
    return new Set(meaningful.map(familyKey)).size >= 2;
  };

  // pack folders: (category, dir)
  const packDirs = [];
  for (const top of childDirs('')) {
    if (isCategory(top)) for (const kid of childDirs(top)) packDirs.push({ category: top, dir: `${top}/${kid}`, name: kid });
    else packDirs.push({ category: '', dir: top, name: top });
  }
  if (hasDirectModels('')) packDirs.push({ category: '', dir: '', name: path.basename(ROOT) });

  // merge editions into families
  const families = new Map();
  for (const p of packDirs) {
    const k = `${p.category}|${familyKey(p.name)}`;
    if (!families.has(k)) families.set(k, { key: familyKey(p.name) || 'root', name: familyName(p.name), category: p.category, dirs: [] });
    families.get(k).dirs.push(p.dir);
  }

  const packs = [];
  const assets = [];
  const usedIds = new Set();
  for (const fam of families.values()) {
    const inFam = (f) => fam.dirs.some((d) => d === '' ? !f.rel.includes('/') : f.rel.startsWith(d + '/'));
    const famFiles = rels.filter(inFam);
    const mtls = new Set(famFiles.filter((f) => /\.mtl$/i.test(f.rel)).map((f) => f.rel));
    const isKayKit = famFiles.some((f) => /kaykit/i.test(f.rel)) || /kaykit/i.test(fam.category);

    const best = new Map();
    for (const f of famFiles) {
      const ext = path.extname(f.rel).toLowerCase();
      if (!RANK[ext]) continue;
      const base = path.basename(f.rel, path.extname(f.rel)).replace(/\.gltf$/i, '');
      if (ext === '.fbx' && ANIM_CLIP.test(base.replace(/_/g, ' '))) continue;
      const dirOf = fam.dirs.find((d) => d === '' || f.rel.startsWith(d + '/'));
      const inPack = f.rel.slice(dirOf ? dirOf.length + 1 : 0).split('/').slice(0, -1);
      const isAnim = inPack.some((s) => /^animations?$/i.test(s)) || /^rig_.*_(general|movement|combat|simulation|special|tools)/i.test(base);
      const isChar = !isAnim && inPack.some((s) => /^characters?$/i.test(s));
      const groupSegs = inPack.filter((s) => !NOISE_DIR.test(s) && !COLOR_DIR_RE.test(s) && !/^rig_/i.test(s) && familyKey(s) !== fam.key);
      const variant = (base.match(VARIANT_RE) || [])[1] || (inPack.find((s) => COLOR_DIR_RE.test(s)) || '');
      const root = base.replace(VARIANT_RE, '');
      const k = `${root.toLowerCase()}|${variant.toLowerCase()}|${isAnim ? 'a' : ''}`;
      const ed = editionOf(f.rel);
      const prev = best.get(k);
      const eds = new Set(prev ? prev.eds : []);
      eds.add(ed);
      if (!prev || RANK[ext] > prev.rank) best.set(k, { f, ext, rank: RANK[ext], root, variant, isAnim, isChar, groupSegs, eds });
      else prev.eds = eds;
    }

    const entries = new Map();
    for (const b of best.values()) {
      const ek = `${b.root.toLowerCase()}|${b.isAnim}|${b.groupSegs.join('/').toLowerCase()}`;
      if (!entries.has(ek)) entries.set(ek, { ...b, eds: new Set(), variants: [] });
      const e = entries.get(ek);
      const v = { id: hashId(b.f.rel), label: b.variant || 'default', u: b.f.rel, f: b.ext.slice(1), s: b.f.size };
      if (b.ext === '.obj' && mtls.has(b.f.rel.slice(0, -4) + '.mtl')) v.m = b.f.rel.slice(0, -4) + '.mtl';
      e.variants.push(v);
      for (const x of b.eds) e.eds.add(x);
    }
    if (!entries.size) continue;

    const packId = (fam.category ? familyKey(fam.category) + '-' : '') + fam.key;
    const list = [...entries.values()];
    const folderGroups = new Set(list.filter((e) => !e.isAnim && !e.isChar).map((e) => e.groupSegs.join('/')));
    const useFolders = folderGroups.size > 1;
    const tokenOf = (e) => e.root.split(/[_\s-]+/)[0].toLowerCase();
    const tokenCount = new Map();
    if (!useFolders) for (const e of list) tokenCount.set(tokenOf(e), (tokenCount.get(tokenOf(e)) || 0) + 1);

    const packAssets = [];
    const allEds = new Set();
    for (const e of list) {
      e.variants.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
      const main = e.variants[0];
      if (usedIds.has(main.id)) continue;
      usedIds.add(main.id);
      let group;
      if (e.isAnim) group = 'Animations';
      else if (e.isChar) group = 'Characters';
      else if (useFolders) group = e.groupSegs.map(cap).join(' / ') || 'General';
      else group = tokenCount.get(tokenOf(e)) >= 3 ? cap(tokenOf(e)) : 'Other';
      for (const x of e.eds) allEds.add(x);
      const a = {
        id: main.id, n: pretty(e.root), p: packId, g: group,
        f: main.f, u: main.u, m: main.m, s: main.s,
        v: e.variants.length > 1 ? e.variants : undefined,
        e: e.eds.has('FREE') || e.eds.has('EA') ? undefined : 'EXTRA',
        t: e.isChar ? 1 : undefined, a: e.isAnim ? 1 : undefined,
      };
      packAssets.push(a);
      assets.push(a);
    }

    const imgs = famFiles.filter((f) => /\.(png|jpe?g|webp)$/i.test(f.rel) && !/textures?\//i.test(f.rel));
    const covers = imgs.filter((f) => IMG_COVER.test(path.basename(f.rel))).sort((a, b) => b.size - a.size).map((f) => f.rel);
    const samples = imgs.filter((f) => IMG_SAMPLE.test(path.basename(f.rel))).map((f) => f.rel).sort();
    const groups = [...new Set(packAssets.map((a) => a.g))].sort((a, b) => {
      const order = (g) => (g === 'Characters' ? 0 : g === 'Animations' ? 2 : g === 'Other' ? 1.5 : 1);
      return order(a) - order(b) || a.localeCompare(b);
    });
    const chars = packAssets.filter((a) => a.t).length;
    packs.push({
      id: packId,
      name: fam.name,
      category: fam.category,
      section: isKayKit ? kaykitSection(fam.key, chars > 0) : (fam.category ? familyKey(fam.category) : 'packs'),
      style: styleOf(`${path.basename(ROOT)}/${fam.category}/${fam.dirs[0]}/${famFiles[0]?.rel || ''}`),
      kaykit: isKayKit || undefined,
      dirs: fam.dirs,
      editions: ['FREE', 'EA', 'EXTRA'].filter((x) => allEds.has(x)),
      cover: covers[0] || samples[0] || null,
      gallery: [...new Set([...covers, ...samples])].slice(0, 8),
      count: packAssets.length,
      files: packAssets.reduce((n, a) => n + (a.v ? a.v.length : 1), 0),
      chars,
      anims: packAssets.filter((a) => a.a).length,
      groups,
      bytes: famFiles.reduce((n, f) => n + f.size, 0),
      added: Math.max(...famFiles.map((f) => f.mtime)),
    });
  }

  // sections: KayKit themes first (only those used), then one per category
  const used = new Set(packs.map((p) => p.section));
  const sections = KAYKIT_SECTIONS.filter((s) => used.has(s.id));
  for (const p of packs) {
    if (sections.some((s) => s.id === p.section)) continue;
    sections.push({ id: p.section, name: p.category ? familyName(p.category) : 'Packs', blurb: p.category ? `${p.category}/` : 'Top-level folders' });
  }

  packs.sort((a, b) => a.name.localeCompare(b.name));
  assets.sort((a, b) => a.n.localeCompare(b.n, undefined, { numeric: true }));
  return { generated: new Date().toISOString(), root: ROOT, sections, packs, assets };
}
