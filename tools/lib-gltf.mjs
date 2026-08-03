/**
 * Shared glTF helpers for the asset pipeline.
 *
 * Both the splitter and the builder need to get a downloaded model into one
 * predictable state first: a flat list of nodes whose geometry is in world
 * space. Getting that wrong is silent - the file still loads, it is just the
 * wrong shape - so it lives in one place.
 */

import { clearNodeTransform, dedup, flatten } from '@gltf-transform/functions';

/**
 * A genuinely independent copy of a mesh.
 *
 * `Property.clone()` copies the *references* to primitives and accessors, so a
 * cloned mesh still shares vertex data with the original. This copies the
 * underlying arrays, which is what makes it safe to bake a transform into one
 * user of a mesh without moving the others.
 */
export function deepCopyMesh(document, mesh) {
  const copy = document.createMesh(mesh.getName());

  const copyAccessor = (accessor) =>
    document
      .createAccessor()
      .setType(accessor.getType())
      .setBuffer(accessor.getBuffer())
      .setArray(accessor.getArray().slice());

  for (const prim of mesh.listPrimitives()) {
    const clone = document
      .createPrimitive()
      .setMode(prim.getMode())
      .setMaterial(prim.getMaterial());

    const indices = prim.getIndices();
    if (indices) clone.setIndices(copyAccessor(indices));
    for (const semantic of prim.listSemantics()) {
      clone.setAttribute(semantic, copyAccessor(prim.getAttribute(semantic)));
    }
    copy.addPrimitive(clone);
  }

  return copy;
}

/**
 * Flattens the hierarchy and bakes every node transform into vertex data.
 *
 * `flatten` removes the node *hierarchy* but leaves each node's own transform
 * in place; it does not touch vertex positions. Anything that reads raw
 * accessor values afterwards - measuring, rescaling, merging - loses whatever
 * was left in those transforms. Skipping this made the Mars colony measure 68 m
 * tall when it is really 5 m, and made kit clusters lose most of their parts.
 *
 * Meshes reused by several nodes are copied first, so baking one node's
 * transform cannot move another.
 *
 * @returns the number of meshes that had to be un-shared.
 */
export async function flattenAndBake(document) {
  await document.transform(flatten(), dedup());

  const claimed = new Set();
  let unshared = 0;

  for (const node of document.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    if (claimed.has(mesh)) {
      node.setMesh(deepCopyMesh(document, mesh));
      unshared++;
    } else {
      claimed.add(mesh);
    }
  }

  for (const node of document.getRoot().listNodes()) {
    if (node.getMesh()) clearNodeTransform(node);
  }

  return unshared;
}

/** Triangle count for a whole document. */
export function trianglesOf(document) {
  let total = 0;
  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const indices = prim.getIndices();
      const position = prim.getAttribute('POSITION');
      total += indices ? indices.getCount() / 3 : (position?.getCount() ?? 0) / 3;
    }
  }
  return Math.round(total);
}

/** Triangle count for a single node's own mesh. */
export function trianglesOfNode(node) {
  const mesh = node.getMesh();
  if (!mesh) return 0;
  let total = 0;
  for (const prim of mesh.listPrimitives()) {
    const indices = prim.getIndices();
    const position = prim.getAttribute('POSITION');
    total += indices ? indices.getCount() / 3 : (position?.getCount() ?? 0) / 3;
  }
  return total;
}
