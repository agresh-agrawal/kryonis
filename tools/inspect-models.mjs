/**
 * Inventory every GLB in a folder.
 *
 * Prints, per file: total size, triangle count, texture inventory, and the
 * top-level nodes with their own triangle counts and bounding boxes. That last
 * part is the point - several of these files are *packs* containing many
 * separate props, and the node list is how we find out what is in one without
 * opening Blender.
 */

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
import fs from 'node:fs';
import path from 'node:path';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

function trianglesOf(mesh) {
  if (!mesh) return 0;
  let total = 0;
  for (const prim of mesh.listPrimitives()) {
    const indices = prim.getIndices();
    const position = prim.getAttribute('POSITION');
    total += indices ? indices.getCount() / 3 : (position?.getCount() ?? 0) / 3;
  }
  return Math.round(total);
}

/** Triangles in a node and everything under it. */
function deepTriangles(node) {
  let total = trianglesOf(node.getMesh());
  for (const child of node.listChildren()) total += deepTriangles(child);
  return total;
}

function fmt(n) {
  return n.toLocaleString('en-US');
}

const folder = process.argv[2];
const files = fs
  .readdirSync(folder)
  .filter((name) => name.toLowerCase().endsWith('.glb') || name.toLowerCase().endsWith('.gltf'));

for (const file of files) {
  const full = path.join(folder, file);
  const bytes = fs.statSync(full).size;

  let document;
  try {
    document = await io.read(full);
  } catch (error) {
    console.log(`\n### ${file}  — FAILED TO READ: ${error.message}`);
    continue;
  }

  const root = document.getRoot();
  const meshes = root.listMeshes();
  const triangles = meshes.reduce((sum, mesh) => sum + trianglesOf(mesh), 0);
  const textures = root.listTextures();
  const textureBytes = textures.reduce((sum, t) => sum + (t.getImage()?.byteLength ?? 0), 0);

  console.log(`\n${'='.repeat(78)}`);
  console.log(`### ${file}`);
  console.log(
    `size ${(bytes / 1e6).toFixed(1)} MB | ${fmt(triangles)} tris | ` +
      `${meshes.length} meshes | ${root.listMaterials().length} materials | ` +
      `${textures.length} textures (${(textureBytes / 1e6).toFixed(1)} MB)`,
  );

  for (const texture of textures) {
    const size = texture.getSize();
    console.log(
      `   tex: ${(texture.getName() || '(unnamed)').slice(0, 34).padEnd(34)} ` +
        `${size ? `${size[0]}x${size[1]}` : '?'}  ${texture.getMimeType()}  ` +
        `${((texture.getImage()?.byteLength ?? 0) / 1e6).toFixed(2)} MB`,
    );
  }

  // Top-level nodes: the separable props in a pack.
  const scene = root.listScenes()[0];
  if (!scene) continue;
  const children = scene.listChildren();
  console.log(`   --- ${children.length} top-level node(s) ---`);

  for (const node of children.slice(0, 60)) {
    const tris = deepTriangles(node);
    let extent = '';
    try {
      const bounds = getBounds(node);
      const size = bounds.max.map((v, i) => (v - bounds.min[i]).toFixed(1));
      extent = `  ${size[0]}x${size[1]}x${size[2]}`;
    } catch {
      // A node with no renderable geometry has no bounds; not an error.
    }
    console.log(
      `   • ${(node.getName() || '(unnamed)').slice(0, 40).padEnd(40)} ` +
        `${fmt(tris).padStart(9)} tris${extent}`,
    );
  }
  if (children.length > 60) console.log(`   … and ${children.length - 60} more`);
}
