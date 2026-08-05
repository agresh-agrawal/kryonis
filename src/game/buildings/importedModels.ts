'use client';

/**
 * Downloaded models, folded into the game's own rendering path.
 *
 * The offline pipeline (`tools/build-models.mjs`) has already done the hard
 * part: each GLB here contains nothing but geometry, pre-scaled to its
 * footprint, origin at the base centre, split into one mesh per material named
 * `mat_<key>` where the key names a material in this game's own library.
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
  // The three hero models, reviewed and kept.
  reactor: 'reactor.glb',
  factory: 'refinery.glb',
  spaceport: 'rocket.glb',

  /*
   * Blocks recovered from the Mars colony diorama.
   *
   * The habitat is deliberately NOT one of them any more. It is the structure
   * a player builds most often and lives in, so it earns purpose-built
   * geometry - a geodesic shell in a regolith berm with a real airlock
   * vestibule - rather than a featureless block that happened to be the right
   * size.
   */
  atrium: 'kit-block-b.glb',

  /*
   * The colony hub.
   *
   * A fortified tower with a landing deck on the roof and a gate at the base -
   * the structure the game opens on, sitting at the centre of the crater. Every
   * road runs back to it and everything the colony buys or sells passes through
   * it, so it replaces the smaller diorama block that stood in for the lander.
   */
  lander: 'hub-tower.glb',
};

/*
 * What was removed, and why it is not coming back.
 *
 * The gallery review rejected the small kit props - the lab, the three plant
 * units, the tank and the dish. They were the weakest pieces in the diorama:
 * near-identical featureless cylinders that read as placeholder next to the
 * hero models, and worse than the procedural buildings they replaced.
 *
 * `kit-panel.glb` went earlier for a harder reason - it is a single quad with
 * no thickness, which vanishes edge-on and z-fights its own foundation pad.
 *
 * Everything not listed above now uses a purpose-built procedural model. That
 * is the better default: geometry authored for this game, at this camera
 * distance, in this palette, with detail where the player actually looks.
 */

const MODEL_PATH = '/models/';

/**
 * Models that are not buildings.
 *
 * Loaded by the same preload pass, keyed by name rather than by `BuildingId`.
 */
export const PROP_MODELS = {
  astronaut: 'astronaut.glb',
} as const;

export type PropId = keyof typeof PROP_MODELS;

const loadedProps = new Map<PropId, BuildingModel>();

/** The imported geometry for a non-building prop, if it loaded. */
export function getImportedProp(id: PropId): BuildingModel | undefined {
  return loadedProps.get(id);
}

/** Populated by `preloadImportedModels`; empty until then. */
const loaded = new Map<BuildingId, BuildingModel>();

let preloadPromise: Promise<void> | null = null;

/**
 * Recovers the material key from a loaded node's name.
 *
 * The offline pipeline writes `mat_<key>`, and reading it back is less
 * straightforward than it looks: three's GLTFLoader runs every node name
 * through `PropertyBinding.sanitizeNodeName`, which strips characters reserved
 * for animation paths - including `:` and `.`. An earlier version of the
 * pipeline used `mat:<key>`, which arrived in the browser as `mathull` and
 * matched nothing, so every model loaded successfully and then silently fell
 * back to procedural geometry.
 *
 * Underscore survives sanitising. Both spellings are accepted anyway, so a
 * stale GLB built by an older pipeline still works.
 */
function materialKeyFromName(name: string): MaterialKey | null {
  const match = /^mat[:_]?(.+)$/.exec(name);
  return match ? (match[1] as MaterialKey) : null;
}

/**
 * Pulls one GLB apart into geometry-per-material-key.
 *
 * World matrices are still applied here even though the pipeline baked node
 * transforms, because the GLTF loader introduces its own root transform for
 * Y-up correction and silently ignoring it would put every model on its side.
 */
function extractModel(scene: THREE.Object3D): BuildingModel {
  const byKey = new Map<MaterialKey, THREE.BufferGeometry[]>();

  scene.updateWorldMatrix(true, true);

  scene.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    const key = materialKeyFromName(child.name || '');
    if (!key) return;

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

    const load = async (file: string): Promise<BuildingModel | null> => {
      try {
        const gltf = await loader.loadAsync(`${MODEL_PATH}${file}`);
        const model = extractModel(gltf.scene);

        // An empty result means the file loaded but contained nothing we
        // recognised - worse than a failure, because it would render an
        // invisible building. Treat it as a miss.
        if (Object.keys(model).length === 0) {
          console.warn(`[models] ${file} contained no "mat_*" meshes; using procedural model`);
          return null;
        }
        return model;
      } catch (error) {
        console.warn(`[models] failed to load ${file}:`, error);
        return null;
      }
    };

    await Promise.all([
      ...(Object.entries(IMPORTED_MODELS) as [BuildingId, string][]).map(async ([id, file]) => {
        const model = await load(file);
        if (model) loaded.set(id, model);
      }),
      ...(Object.entries(PROP_MODELS) as [PropId, string][]).map(async ([id, file]) => {
        const model = await load(file);
        if (model) loadedProps.set(id, model);
      }),
    ]);
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
