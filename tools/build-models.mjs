/**
 * The asset pipeline.
 *
 * Turns arbitrary downloaded GLB/FBX models into something this game can
 * actually draw, which is a much stronger requirement than "a GLB that loads".
 *
 * KRYONIS renders every structure as an InstancedMesh per (building type x
 * material), with all materials coming from one small procedural library. That
 * is what keeps a two-hundred-structure colony at a few dozen draw calls, and
 * what keeps the whole scene inside the 16 fragment-sampler budget that ANGLE
 * gives us. Dropping imported models in with their own PBR materials would
 * throw away both.
 *
 * So this script imports **geometry only**:
 *
 *   1. Simplify until the triangle count is sane for something drawn 40-100px
 *      tall. The reactor arrives at 1.78 million triangles.
 *   2. Classify each source material into one of the game's own material keys,
 *      by colour and metalness. An imported model then looks like it belongs in
 *      the game rather than like a sticker on it.
 *   3. Merge every primitive sharing a key into one mesh named `mat_<key>`.
 *      Underscore, not colon: three's GLTFLoader strips `:` from node names
 *      as a reserved animation-path character, so `mat:hull` arrives in the
 *      browser as `mathull` and the runtime cannot read the key back out.
 *   4. Normalise scale and origin: footprint fitted to its tile size, base at
 *      y = 0, centred on XZ. Downloaded models are authored at every
 *      conceivable scale and none of them agree on where the origin goes.
 *
 * The runtime loader then just reads meshes named `mat_*` and hands them to the
 * existing instancing path, which needs no changes at all.
 *
 * Usage:  node tools/build-models.mjs
 */

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  dedup,
  flatten,
  join,
  joinPrimitives,
  normals,
  prune,
  simplify,
  weld,
} from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { flattenAndBake, trianglesOf } from './lib-gltf.mjs';

/*
 * Sources are read in place rather than copied into the working folder.
 *
 * Two models used to be duplicated here - a 30 MB tower and a 1.5 MB astronaut -
 * purely so the paths were shorter. That is 32 MB of the same bytes twice, and
 * a second copy that silently goes stale the moment the original is replaced.
 */
const SOURCE_DIR = 'Models i have added self';
const OUT_DIR = 'public/models';

/**
 * The material keys the game's `MaterialLibrary` provides.
 * Kept in sync by hand; a key that does not exist there renders as `hull`.
 */
const MATERIAL_KEYS = [
  'hull',
  'metal',
  'dark',
  'gold',
  'glass',
  'window',
  'solar',
  'accent',
  'hazard',
  'concrete',
  'soil',
];

/**
 * Maps a source material onto one of ours.
 *
 * Deliberately crude. The goal is not to reproduce the author's intent - it is
 * to land every surface somewhere plausible in *our* palette, so the result
 * reads as one art direction. Order matters: the first match wins.
 */
function classifyMaterial(material) {
  if (!material) return 'hull';

  const name = (material.getName() || '').toLowerCase();
  const [r, g, b, a] = material.getBaseColorFactor() ?? [1, 1, 1, 1];
  const metalness = material.getMetallicFactor() ?? 0;
  const roughness = material.getRoughnessFactor() ?? 1;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  // Names are the strongest signal when the author bothered to provide one.
  for (const key of MATERIAL_KEYS) {
    if (name.includes(key)) return key;
  }
  if (/glass|window|transparent|screen/.test(name)) return 'glass';
  if (/panel|photovolt|pv|cell/.test(name)) return 'solar';
  if (/foil|mli|insulat|brass|copper/.test(name)) return 'gold';
  if (/concrete|cement|pad|ground|floor/.test(name)) return 'concrete';
  if (/warn|caution|danger|stripe|orange/.test(name)) return 'hazard';

  // Then the numbers.
  if (a < 0.85) return 'glass';
  if (metalness > 0.6 && r > 0.45 && g > 0.3 && b < 0.35) return 'gold';
  if (luminance < 0.06 && roughness < 0.45) return 'solar';
  if (luminance < 0.16) return 'dark';
  if (metalness > 0.55) return 'metal';
  if (luminance > 0.62) return 'hull';
  if (r > 0.45 && g < 0.42 && b < 0.3) return 'hazard';
  return 'metal';
}

/** World-space bounds of every position attribute, after `flatten` + `join`. */
function computeBounds(document) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];

  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const position = prim.getAttribute('POSITION');
      if (!position) continue;
      const element = [0, 0, 0];
      for (let i = 0; i < position.getCount(); i++) {
        position.getElement(i, element);
        for (let axis = 0; axis < 3; axis++) {
          if (element[axis] < min[axis]) min[axis] = element[axis];
          if (element[axis] > max[axis]) max[axis] = element[axis];
        }
      }
    }
  }
  return { min, max };
}

/**
 * Rescales and recentres every vertex in place.
 *
 * Applied to the accessors rather than to a node transform, because the runtime
 * merges these geometries and a node transform would be lost in the merge.
 */
function normalise(document, targetFootprint, targetHeight, rotateY = 0) {
  const { min, max } = computeBounds(document);
  if (!Number.isFinite(min[0])) return null;

  const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  process.stdout.write(
    `  source extent ${size.map((v) => v.toFixed(2)).join(' x ')} m (author units)\n`,
  );

  // Fit the wider horizontal axis to the footprint, but never let the model
  // exceed the height cap - a tall thin mast scaled to its footprint ends up
  // through the roof of the camera frustum.
  const footprintScale = targetFootprint / Math.max(size[0], size[2], 1e-6);
  const heightScale = targetHeight / Math.max(size[1], 1e-6);
  const scale = Math.min(footprintScale, heightScale);

  const centreX = (min[0] + max[0]) / 2;
  const centreZ = (min[2] + max[2]) / 2;
  const cos = Math.cos(rotateY);
  const sin = Math.sin(rotateY);

  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const position = prim.getAttribute('POSITION');
      if (!position) continue;
      const element = [0, 0, 0];
      for (let i = 0; i < position.getCount(); i++) {
        position.getElement(i, element);
        // Centre, scale, then yaw about the vertical axis.
        const x = (element[0] - centreX) * scale;
        const z = (element[2] - centreZ) * scale;
        position.setElement(i, [
          x * cos + z * sin,
          (element[1] - min[1]) * scale, // base to y = 0
          -x * sin + z * cos,
        ]);
      }
    }
  }

  return { scale, size: size.map((v) => v * scale) };
}

/**
 * Rebuilds the document as one mesh per material key.
 *
 * Primitives are re-parented onto new meshes named `mat_<key>`; the runtime
 * reads those names and needs to know nothing else about the file.
 */
function groupByMaterialKey(document, forceMaterial = null) {
  const root = document.getRoot();
  const buckets = new Map();

  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const key = forceMaterial ?? classifyMaterial(prim.getMaterial());
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(prim);
      mesh.removePrimitive(prim);
    }
  }

  // Drop the old scene graph entirely and rebuild a flat one.
  for (const scene of root.listScenes()) {
    for (const node of scene.listChildren()) node.dispose();
  }
  for (const mesh of root.listMeshes()) mesh.dispose();

  const scene = root.listScenes()[0] ?? document.createScene();
  const counts = {};

  for (const [key, primitives] of buckets) {
    const mesh = document.createMesh(`mat_${key}`);

    for (const prim of primitives) {
      // Materials are discarded at runtime, but a primitive with a dangling
      // material reference will not survive `prune`.
      prim.setMaterial(null);
    }

    /*
     * Fuse the whole bucket into a single primitive.
     *
     * This is the step that makes simplification possible: meshopt collapses
     * edges within a primitive and cannot cross a boundary between two, so a
     * model left as hundreds of small primitives is effectively
     * un-simplifiable. `joinPrimitives` is a plain utility here rather than a
     * transform, and it throws if the inputs disagree on mode or attributes -
     * hence the fallback, which keeps a difficult model usable rather than
     * failing the whole build.
     */
    let joined = null;
    if (primitives.length > 1) {
      try {
        joined = joinPrimitives(primitives);
      } catch (error) {
        process.stdout.write(`  ! could not fuse "${key}": ${error.message}\n`);
      }
    }

    if (joined) {
      mesh.addPrimitive(joined);
      for (const prim of primitives) prim.dispose();
    } else {
      for (const prim of primitives) mesh.addPrimitive(prim);
    }

    scene.addChild(document.createNode(`mat_${key}`).setMesh(mesh));
    counts[key] = primitives.length;
  }

  return counts;
}

/**
 * What to build, and how big each thing is in world metres.
 *
 * A tile is 2 m, so a `[2,2]` building in the catalog occupies 4 x 4 m. The
 * footprints below are set slightly under their tile allowance so that adjacent
 * structures never visually touch, and heights are chosen to keep the skyline
 * readable rather than to match the source model's proportions.
 */
const TARGETS = [
  /*
   * The colony hub.
   *
   * A fortified tower with a flat landing deck on the roof and a gate at the
   * base. This is where the game starts and where everything arrives and
   * leaves, so it is deliberately the largest structure in the colony and the
   * one every road runs back to.
   *
   * Nearly a million triangles and three 4K textures on the way in; the
   * geometry survives, the textures do not - it is lit with the game's own
   * palette like every other import.
   */
  {
    source: '../scifi-watchtower-es/source/tripo_pbr_model_b0518ac6-c8ca-44aa-bdac-632469f0c8f9.glb',
    out: 'hub-tower.glb',
    footprint: 7.2,
    height: 10.5,
    maxTriangles: 16000,
  },

  // --- The three hero models --------------------------------------------
  { source: 'reactor.glb', out: 'reactor.glb', footprint: 3.7, height: 4.4, maxTriangles: 9000 },
  {
    source: 'offshore_oil_rig.glb',
    out: 'refinery.glb',
    footprint: 5.6,
    height: 7.5,
    maxTriangles: 14000,
  },
  { source: 'Rocket.glb', out: 'rocket.glb', footprint: 7.4, height: 19, maxTriangles: 14000 },

  /*
   * Props recovered from the Mars colony diorama by tools/split-kit.mjs.
   *
   * The source names everything Cube.017, so what each one *is* was read off
   * its proportions and confirmed in the /models gallery. Sizes here are the
   * catalog footprints they are assigned to, not the sizes they arrived at.
   */
  // Large modules - habitat-sized blocks, 5-7 m across. These three survived
  // the gallery review; the smaller kit props did not and were deleted.
  { source: '_kit/kit-01.glb', out: 'kit-block-a.glb', footprint: 5.6, height: 4.6, maxTriangles: 3000 },
  { source: '_kit/kit-02.glb', out: 'kit-block-b.glb', footprint: 5.6, height: 4.6, maxTriangles: 3000 },
  { source: '_kit/kit-03.glb', out: 'kit-block-c.glb', footprint: 5.6, height: 4.6, maxTriangles: 2500 },

  /*
   * The crew.
   *
   * Footprint is set deliberately large so the height cap wins the fit: a
   * person is defined by being 1.8 m tall, not by how wide they are.
   *
   * The triangle budget is low because this is the most-instanced geometry in
   * the game - up to 240 of them - and because the skeleton is stripped on the
   * way through. That is not a limitation being worked around, it is the
   * requirement: skinned meshes cannot be instanced, and an earlier rigged
   * character dropped the crew cap from 240 to 14.
   */
  {
    source: '../_archive/models/astronaut-on-suit.glb',
    out: 'astronaut.glb',
    footprint: 6,
    height: 1.78,
    maxTriangles: 1600,
    // The source is a single textured material, so nothing can be separated
    // out of it by classification. Forcing the whole body to the white suit
    // material is the honest answer: the visor and backpack are then added as
    // procedural parts on top, where they can be given their own materials and
    // made to read at forty pixels tall.
    forceMaterial: 'hull',
  },
];

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
await MeshoptSimplifier.ready;

fs.mkdirSync(OUT_DIR, { recursive: true });

/*
 * The diorama is split on demand.
 *
 * `_kit/` holds the props recovered from mars_colony.glb, and three targets
 * below read from it. It used to be a folder you had to remember to generate by
 * running another script first - so deleting it as "an intermediate" silently
 * broke the build with a SKIP rather than an error. Regenerating it here makes
 * the pipeline one command with no hidden prerequisite.
 */
{
  const kitDir = path.join(SOURCE_DIR, '_kit');
  const diorama = path.join(SOURCE_DIR, 'mars_colony.glb');
  if (!fs.existsSync(kitDir) && fs.existsSync(diorama)) {
    console.log('_kit/ missing - splitting the diorama first');
    execFileSync(process.execPath, ['tools/split-kit.mjs', diorama, kitDir, '1.6'], {
      stdio: ['ignore', 'ignore', 'inherit'],
    });
  }
}

const report = [];

for (const target of TARGETS) {
  const inputPath = path.join(SOURCE_DIR, target.source);
  if (!fs.existsSync(inputPath)) {
    console.log(`SKIP ${target.source} — not found`);
    continue;
  }

  const beforeBytes = fs.statSync(inputPath).size;
  process.stdout.write(`\n${target.source} → ${target.out}\n`);

  const document = await io.read(inputPath);
  const beforeTris = trianglesOf(document);
  process.stdout.write(`  in : ${(beforeBytes / 1e6).toFixed(1)} MB, ${beforeTris.toLocaleString()} tris\n`);

  /*
   * Order matters more than anything else in this script.
   *
   * Simplification has to happen *after* the merge, not before. Meshopt works
   * per primitive and cannot collapse an edge that crosses a primitive
   * boundary, so simplifying the oil rig while it was still 123 separate
   * meshes with 100 materials removed almost nothing - it reached 74% of the
   * original and stayed a 65 MB file. Merged into five welded surfaces first,
   * the same call reaches the target.
   */
  const unshared = await flattenAndBake(document);
  if (unshared > 0) process.stdout.write(`  un-shared ${unshared} reused mesh(es)\n`);

  /*
   * Strip to POSITION alone before merging - including normals.
   *
   * Two reasons, and the second one is the whole ballgame:
   *
   * 1. `join` will not merge primitives whose attribute sets differ, and a
   *    downloaded model is rarely consistent about TEXCOORD_1 or COLOR_0.
   *
   * 2. glTF-Transform v4's `weld` merges only *bitwise identical* vertices -
   *    there is no distance tolerance. On any hard-surface model the normals
   *    differ on every side of every edge, so with normals present essentially
   *    nothing welds, the mesh stays triangle soup, and meshopt cannot collapse
   *    an edge it cannot see. That is why the oil rig would not go below 76% of
   *    its original size no matter what ratio was asked for.
   *
   * Normals are regenerated after simplification instead.
   */
  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      for (const name of prim.listSemantics()) {
        if (name !== 'POSITION') prim.setAttribute(name, null);
      }
      prim.listTargets().forEach((target) => prim.removeTarget(target));
    }
  }
  await document.transform(prune(), dedup());

  const counts = groupByMaterialKey(document, target.forceMaterial ?? null);
  await document.transform(dedup(), prune());

  const primitiveCount = document
    .getRoot()
    .listMeshes()
    .reduce((sum, mesh) => sum + mesh.listPrimitives().length, 0);
  process.stdout.write(`  merged into ${primitiveCount} primitive(s)\n`);

  /*
   * Normalise before welding, not after.
   *
   * Weld tolerance is an absolute distance, and these models arrive in wildly
   * different author units - the oil rig is 147 units long, the reactor 5. A
   * tolerance tuned for one is meaningless for the other, and an unwelded mesh
   * is triangle soup that meshopt cannot collapse at all: the rig sat at 76% of
   * its original size no matter what ratio was requested. Scaling everything to
   * real metres first makes one tolerance correct for all of them.
   */
  const fitted = normalise(document, target.footprint, target.height, target.rotateY ?? 0);

  const mergedTris = trianglesOf(document);
  if (mergedTris > target.maxTriangles) {
    const ratio = target.maxTriangles / mergedTris;
    await document.transform(
      weld(),
      simplify({
        simplifier: MeshoptSimplifier,
        ratio,
        // Very generous. These are drawn 40-100px tall, where nothing but the
        // silhouette survives; a tight error bound just makes meshopt refuse to
        // hit the ratio and hand back a file we cannot ship.
        error: 0.9,
        lockBorder: false,
      }),
      prune(),
    );
    process.stdout.write(
      `  merged ${mergedTris.toLocaleString()} → simplify ratio ${(ratio * 100).toFixed(2)}%\n`,
    );
  }

  /*
   * Regenerate normals, then quantise positions.
   *
   * Flat face normals are the correct choice here rather than smoothed ones:
   * every one of these is industrial hard-surface geometry, and the game's own
   * procedural buildings are faceted too, so this is also what makes an
   * imported model sit next to a generated one without looking pasted in.
   */
  /*
   * Normals regenerated; positions deliberately NOT quantised.
   *
   * `quantize()` normalises positions into +/-1 and moves the real scale onto
   * the node transform. It saves a few hundred kilobytes across the whole set,
   * and in exchange every consumer has to remember to compose the node matrix
   * before reading a vertex. That indirection is exactly the kind of thing that
   * fails silently - a model renders at 1/9th size and nothing errors - so for
   * three megabytes of total payload it is not worth it. Plain float positions
   * in real metres are what the rest of the pipeline assumes.
   */
  await document.transform(normals({ overwrite: true }), prune(), dedup());

  // Textures and materials are not used at runtime; removing them is most of
  // the file-size win on models like the rocket.
  for (const texture of document.getRoot().listTextures()) texture.dispose();
  for (const material of document.getRoot().listMaterials()) material.dispose();

  const outPath = path.join(OUT_DIR, target.out);
  await io.write(outPath, document);

  const afterBytes = fs.statSync(outPath).size;
  const afterTris = trianglesOf(document);

  process.stdout.write(
    `  out: ${(afterBytes / 1e6).toFixed(2)} MB, ${afterTris.toLocaleString()} tris ` +
      `(${(afterBytes / beforeBytes * 100).toFixed(1)}% of original)\n`,
  );
  process.stdout.write(`  materials: ${Object.keys(counts).join(', ')}\n`);
  if (fitted) {
    process.stdout.write(
      `  fitted to ${fitted.size.map((v) => v.toFixed(1)).join(' x ')} m\n`,
    );
  }

  report.push({
    source: target.source,
    out: target.out,
    beforeMB: +(beforeBytes / 1e6).toFixed(1),
    afterMB: +(afterBytes / 1e6).toFixed(2),
    beforeTris,
    afterTris,
    materials: Object.keys(counts),
  });
}

fs.writeFileSync(path.join(OUT_DIR, 'build-report.json'), JSON.stringify(report, null, 2));
console.log(`\nDone. ${report.length} model(s) written to ${OUT_DIR}/`);
