/**
 * Splits a scene-shaped GLB into its separate props.
 *
 * `mars_colony.glb` is not a model, it is a diorama: two hundred top-level
 * nodes named Cube.017 and Cylinder.008 that together form a small base. The
 * useful things in it are the individual structures, and nothing in the file
 * says where one ends and the next begins.
 *
 * Proximity does say so, though. Props in a diorama are laid out with space
 * between them, so single-linkage clustering on the XZ centroids recovers the
 * groupings the author worked in - a dome and its airlock and its handrails end
 * up in one cluster because they are touching, and the dome fifteen metres away
 * ends up in another.
 *
 * Run this first; `build-models.mjs` then processes each extracted cluster like
 * any other downloaded model.
 *
 * Usage: node tools/split-kit.mjs <input.glb> <outDir> [clusterRadius]
 */

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, getBounds, prune } from '@gltf-transform/functions';
import fs from 'node:fs';
import path from 'node:path';

import { flattenAndBake, trianglesOfNode } from './lib-gltf.mjs';

const [, , inputPath, outDir, radiusArg] = process.argv;
const CLUSTER_RADIUS = Number(radiusArg ?? 3.2);
/** Below this, a cluster is a stray bolt rather than a prop worth exporting. */
const MIN_TRIANGLES = 120;
const MIN_EXTENT = 0.8;

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

/** Loads, flattens and bakes transforms so every node is in world space. */
async function loadFlattened() {
  const document = await io.read(inputPath);
  await flattenAndBake(document);
  return document;
}

const probe = await loadFlattened();
const scene = probe.getRoot().listScenes()[0];
const nodes = scene.listChildren().filter((node) => node.getMesh());

// --- Measure every node -----------------------------------------------------
const entries = nodes.map((node, index) => {
  const bounds = getBounds(node);
  return {
    index,
    name: node.getName(),
    centre: [
      (bounds.min[0] + bounds.max[0]) / 2,
      (bounds.min[1] + bounds.max[1]) / 2,
      (bounds.min[2] + bounds.max[2]) / 2,
    ],
    min: bounds.min,
    max: bounds.max,
    triangles: trianglesOfNode(node),
  };
});

// --- Single-linkage clustering on XZ ---------------------------------------
// Union-find: two props belong together if any of their parts are within the
// radius of each other, which is what "touching" means for a diorama.
const parent = entries.map((_, i) => i);
const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
const union = (a, b) => {
  const ra = find(a);
  const rb = find(b);
  if (ra !== rb) parent[rb] = ra;
};

for (let i = 0; i < entries.length; i++) {
  for (let j = i + 1; j < entries.length; j++) {
    const dx = entries[i].centre[0] - entries[j].centre[0];
    const dz = entries[i].centre[2] - entries[j].centre[2];
    if (Math.hypot(dx, dz) <= CLUSTER_RADIUS) union(i, j);
  }
}

const clusters = new Map();
for (let i = 0; i < entries.length; i++) {
  const root = find(i);
  if (!clusters.has(root)) clusters.set(root, []);
  clusters.get(root).push(entries[i]);
}

// --- Keep the ones worth exporting -----------------------------------------
const kept = [];
for (const [, members] of clusters) {
  const triangles = members.reduce((sum, m) => sum + m.triangles, 0);
  const min = [0, 1, 2].map((a) => Math.min(...members.map((m) => m.min[a])));
  const max = [0, 1, 2].map((a) => Math.max(...members.map((m) => m.max[a])));
  const size = [0, 1, 2].map((a) => max[a] - min[a]);

  if (triangles < MIN_TRIANGLES) continue;
  if (Math.max(size[0], size[2]) < MIN_EXTENT) continue;

  kept.push({ members, triangles, size, indices: new Set(members.map((m) => m.index)) });
}

kept.sort((a, b) => b.triangles - a.triangles);

/*
 * Drop repeats.
 *
 * A diorama repeats its modules - the source lays the same habitat block down
 * five times in different rotations. They cluster separately and correctly, but
 * exporting all five would give the game five identical models under five
 * different names. Two clusters are treated as the same prop when they have the
 * same part count, the same triangle count and the same sorted dimensions;
 * sorting the dimensions is what makes a rotated copy match its original.
 */
const unique = [];
const signatures = new Set();
for (const cluster of kept) {
  const signature = [
    cluster.members.length,
    Math.round(cluster.triangles),
    ...[...cluster.size].sort((a, b) => a - b).map((v) => v.toFixed(1)),
  ].join('|');

  if (signatures.has(signature)) continue;
  signatures.add(signature);
  unique.push(cluster);
}

console.log(`  (${kept.length - unique.length} duplicate shape(s) skipped)`);
kept.length = 0;
kept.push(...unique);

console.log(`${path.basename(inputPath)}: ${entries.length} parts → ${clusters.size} clusters, ${kept.length} worth keeping\n`);

fs.mkdirSync(outDir, { recursive: true });

let written = 0;
for (const [rank, cluster] of kept.entries()) {
  // Re-read per cluster: mutating and re-mutating one document in place is far
  // more error-prone than starting clean each time, and the file is small.
  const document = await loadFlattened();
  const clusterScene = document.getRoot().listScenes()[0];
  const clusterNodes = clusterScene.listChildren().filter((node) => node.getMesh());

  clusterNodes.forEach((node, index) => {
    if (!cluster.indices.has(index)) node.dispose();
  });
  await document.transform(prune(), dedup());

  const name = `kit-${String(rank + 1).padStart(2, '0')}`;
  await io.write(path.join(outDir, `${name}.glb`), document);
  written++;

  console.log(
    `  ${name}  ${String(cluster.members.length).padStart(3)} parts  ` +
      `${String(Math.round(cluster.triangles)).padStart(6)} tris  ` +
      `${cluster.size.map((v) => v.toFixed(1)).join(' x ')} m`,
  );
}

console.log(`\nWrote ${written} cluster(s) to ${outDir}/`);
