'use client';

/**
 * Downloaded models, folded into the game's own rendering path.
 *
 * The offline pipeline (`tools/build-models.mjs`) has already done the hard
 * part: each GLB here contains nothing but geometry, pre-scaled to its
 * footprint, origin at the base centre, split into one mesh per material named
 * `mat:<key>` where the key names a material in this game's own library.
 *
 * So all this has to do is read those meshes out and hand back exactly the same
 * `BuildingModel` shape that `buildModel()` produces from procedural parts. The
 * instancing layer, the construction animation, the selection tint and the
 * foundation plinths then work on imported models with no changes at all - an
 * imported building is not a special case anywhere downstream of this file.
 *
 * Everything is preloaded during the intro video rather than on demand. Three
 * megabytes arrives long before the player can place anything, and a model that
 * popped in halfway through a build would be worse than one that was never
 * there.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import type { BuildingModel } from './model';
import type { MaterialKey } from './materials';
import type { BuildingId } from './catalog';

/**
 * Which downloaded model stands in for which structure.
 *
 * Anything absent from this map keeps its procedural model, which is the right
 * default: a generated building that fits the art direction beats a downloaded
 * one that does not.
 */
export const IMPORTED_MODELS: Partial<Record<BuildingId, string>> = {
  reactor: 'reactor.glb',
  factory: 'refinery.glb',
  spaceport: 'rocket.glb',

  habitat: 'kit-block-a.glb',
  atrium: 'kit-block-b.glb',
  lander: 'kit-block-c.glb',
  lab: 'kit-lab.glb',

  oxygen: 'kit-plant-a.glb',
  water: 'kit-plant-b.glb',
  fuelplant: 'kit-plant-c.glb',
  storage: 'kit-tank.glb',

  comms: 'kit-dish.glb',
  solar: 'kit-panel.glb',
};

const MODEL_PATH = '/models/';

/** Populated by `preloadImportedModels`; empty until then. */
const loaded = new Map<BuildingId, BuildingModel>();

let preloadPromise: Promise<void> | null = null;

/**
 * Pulls one GLB apart into geometry-per-material-key.
 *
 * Meshes are named `mat:<key>` by the offline pipeline. World matrices are
 * still applied here even though the pipeline baked node transforms, because
 * the GLTF loader may introduce its own root transform for Y-up correction and
 * silently ignoring it would put every model on its side.
 */
function extractModel(scene: THREE.Object3D): BuildingModel {
  const byKey = new Map<MaterialKey, THREE.BufferGeometry[]>();

  scene.updateWorldMatrix(true, true);

  scene.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    const name = child.name || '';
    if (!name.startsWith('mat:')) return;
    const key = name.slice(4) as MaterialKey;

    const geometry = child.geometry.clone() as THREE.BufferGeometry;
    geometry.applyMatrix4(child.matrixWorld);

    // Merging demands identical attribute sets. The pipeline emits position and
    // normal only, but a stray attribute here would fail the merge for the
    // whole building rather than for one part.
    for (const attribute of Object.keys(geometry.attributes)) {
      if (attribute !== 'position' && attribute !== 'normal') {
        geometry.deleteAttribute(attribute);
      }
    }
    if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();

    const list = byKey.get(key);
    if (list) list.push(geometry);
    else byKey.set(key, [geometry]);
  });

  const model: BuildingModel = {};
  for (const [key, geometries] of byKey) {
    const merged =
      geometries.length === 1 ? geometries[0] : mergeGeometries(geometries, false);
    if (!merged) continue;
    merged.computeBoundingBox();
    merged.computeBoundingSphere();
    model[key] = merged;
    if (geometries.length > 1) for (const geometry of geometries) geometry.dispose();
  }

  return model;
}

/**
 * Loads every imported model.
 *
 * Failures are per-model and non-fatal: a missing or corrupt file leaves that
 * structure on its procedural model and logs, rather than taking down the whole
 * colony. This runs behind the intro video, where a stall costs nothing.
 */
export function preloadImportedModels(): Promise<void> {
  if (preloadPromise) return preloadPromise;

  preloadPromise = (async () => {
    const loader = new GLTFLoader();
    const entries = Object.entries(IMPORTED_MODELS) as [BuildingId, string][];

    await Promise.all(
      entries.map(async ([id, file]) => {
        try {
          const gltf = await loader.loadAsync(`${MODEL_PATH}${file}`);
          const model = extractModel(gltf.scene);

          // An empty result means the file loaded but contained nothing we
          // recognised - worse than a failure, because it would render an
          // invisible building. Treat it as a miss.
          if (Object.keys(model).length === 0) {
            console.warn(`[models] ${file} contained no "mat:*" meshes; using procedural model`);
            return;
          }

          loaded.set(id, model);
        } catch (error) {
          console.warn(`[models] failed to load ${file}:`, error);
        }
      }),
    );
  })();

  return preloadPromise;
}

/** The imported model for a structure, if one loaded successfully. */
export function getImportedModel(id: BuildingId): BuildingModel | undefined {
  return loaded.get(id);
}

/** How many imported models are in use. Surfaced in the model gallery. */
export function importedModelCount(): number {
  return loaded.size;
}
