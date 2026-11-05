# Asset gotchas

Hard-won lessons from building games on KayKit, Kenney and Quaternius packs. Check the matching item before writing loader code for a new pack.

## Contents
- KayKit characters and rigs
- Weapons and hand slots
- Kenney OBJ + MTL colours
- Scale between packs
- glTF textures that go missing
- FBX units and textures
- Duplicate formats and editions
- Style cohesion

## KayKit characters and rigs

A KayKit character animates only if its glb has a skin (`skins` > 0) and the standard bone names (`hand.r`, `handslot.r` on Rig_Medium). Then the shared clip files (`Rig_Medium_General.glb`, `Rig_Medium_MovementBasic.glb`, Character Animations `CombatMelee` and so on) retarget onto it by bone name: load the clips once, play them on any character with the same rig. Large creatures use Rig_Large, with its own clip set.

Some "mini pack" or "warband" characters are loose parts with no skeleton. They break when animated. Use them as static decoration. Diagnose by opening the model in the explorer: the viewer shows `rig: none` and a warning, or dump the glb JSON and check `skins`.

Rig_Large and Rig_Medium share most bone names but not proportions: a Rig_Large clip on a Rig_Medium character explodes it. The rig's root node is named `Rig_Medium` or `Rig_Large`, so match clip files by that name. The explorer does this when it borrows clips.

Clone rigged characters with `SkeletonUtils.clone()`, not `object.clone()`, or every copy shares one skeleton.

## Weapons and hand slots

Attach weapons to the `handslot.r` / `handslot.l` bones (three.js names them `handslotr` / `handslotl`). Some adventurer models embed every weapon variant at once: hide all but one, or the unit holds three swords.

## Kenney OBJ + MTL colours

Blender exports MTL colours (`Kd`) in linear space; three.js MTLLoader treats them as sRGB, so everything looks dark and muddy. Fix on load: `material.color.convertLinearToSRGB()`. Also set `side: THREE.DoubleSide`: Kenney awnings and canvas planes are single-sided and vanish from behind. Prefer the GLB versions of Kenney kits when they exist.

## Scale between packs

Kenney buildings are about 1 unit tall, KayKit characters about 1.9, KayKit hex tiles 2.0 wide (flat to flat), the KayKit castle about 4. Mixing packs needs 2 to 7x scale factors. Measure, do not guess: the explorer viewer shows dimensions, or compute `new THREE.Box3().setFromObject(obj).getSize(v)`. Put the scale per model in one table (the starter uses `SCALE` in `assets.js`).

## glTF textures that go missing

A `.gltf` names its texture with a relative `images[].uri`. If that file is not next to the gltf you get a silent 404 and a white, untextured mesh. Fix: load from the folder where the texture sits (packs often ship a complete copy under `Assets/gltf/`), or copy the atlas next to the model. The explorer viewer flags missing files.

## FBX units and textures

FBX files from many asset stores are in centimeters: a lamp post reads 1000 units. Scale by 0.01. Load with `three/addons/loaders/FBXLoader.js` straight from the import map. Textures are often not found automatically (mesh and texture name prefixes differ): load each texture yourself onto a `MeshStandardMaterial`, with `tex.flipY = false` and `tex.colorSpace = THREE.SRGBColorSpace`. Emission maps make lamps and fires glow at night. `.tga` needs `TGALoader`.

## Duplicate formats and editions

Packs ship the same model as glb, gltf, obj and fbx, and sometimes as a FREE and an EXTRA edition. Prefer glb > gltf > obj > fbx and one edition. The explorer already merges these into one card. Colour variants (`_red`, `_blue`, `_Color1`) are variants of one model, pick one per faction.

## Style cohesion

Pick one main pack and only add packs that match its look: same polygon density, same palette logic (flat colours vs textures), same proportions. KayKit with KayKit is safe. Blocky/voxel next to smooth low-poly always looks wrong. When in doubt, put both in `?gallery` and screenshot them side by side.
