/**
 * The colony's material palette.
 *
 * Every structure in KRYONIS is assembled from this fixed set of surfaces, for
 * two reasons. Visually it keeps the colony reading as one procurement
 * programme rather than a pile of unrelated props. Technically it is what makes
 * the renderer scale: geometry is merged per material, so a hundred habitats
 * cost the same handful of draw calls as one.
 *
 * The surfaces are drawn from real spaceflight hardware - white thermal paint,
 * bare machined aluminium, gold multi-layer insulation, dark photovoltaic
 * glass - which is most of what makes a procedural model read as "NASA" rather
 * than "generic sci-fi".
 */

import * as THREE from 'three';

import {
  createConcreteTexture,
  createHullTexture,
  createMetalTexture,
  createRegolithNormalMap,
  createSolarTexture,
} from '../render/textures';

export type MaterialKey =
  | 'hull'
  | 'metal'
  | 'dark'
  | 'gold'
  | 'glass'
  | 'window'
  | 'solar'
  | 'accent'
  | 'hazard'
  | 'concrete'
  | 'soil';

/** Emissive intensity of interior lighting during the day vs. at night. */
const WINDOW_DAY = 0.05;
const WINDOW_NIGHT = 2.4;

export class MaterialLibrary {
  private materials: Record<MaterialKey, THREE.MeshStandardMaterial>;
  private elapsed = 0;

  /** Canvas-generated maps, disposed with the library. */
  private textures: THREE.Texture[] = [];

  constructor() {
    /**
     * Surface maps.
     *
     * Every one is generated at runtime - the project ships no image assets -
     * and each material takes at most a colour map plus one shared detail
     * normal. That ceiling is deliberate: the fragment sampler budget on a
     * typical ANGLE context is 16 units, and shadow maps have to fit too.
     */
    const hullMap = createHullTexture(512);
    hullMap.repeat.set(2, 2);

    const solarMap = createSolarTexture(512);

    const concreteMap = createConcreteTexture(256);
    concreteMap.repeat.set(3, 3);

    const metalMap = createMetalTexture(256);
    metalMap.repeat.set(2, 2);

    // One shared micro-normal across the hull, metal and concrete, so panels
    // and castings catch the light instead of reading as flat plastic.
    const detailNormal = createRegolithNormalMap(256, 9090, 1.4);
    detailNormal.repeat.set(4, 4);

    this.textures = [hullMap, solarMap, concreteMap, metalMap, detailNormal];

    this.materials = {
      // White thermal-control paint over composite. Slightly warm, never pure
      // white - pure white blows out badly against a butterscotch sky.
      hull: new THREE.MeshStandardMaterial({
        color: '#e4e1da',
        map: hullMap,
        normalMap: detailNormal,
        normalScale: new THREE.Vector2(0.35, 0.35),
        roughness: 0.62,
        metalness: 0.04,
      }),

      // Machined and extruded aluminium: trusses, frames, landing legs.
      metal: new THREE.MeshStandardMaterial({
        color: '#b8bcc2',
        map: metalMap,
        normalMap: detailNormal,
        normalScale: new THREE.Vector2(0.22, 0.22),
        roughness: 0.34,
        metalness: 0.92,
      }),

      // Machinery, seals, tyres, radiator backs.
      dark: new THREE.MeshStandardMaterial({
        color: '#33363b',
        roughness: 0.68,
        metalness: 0.45,
      }),

      // Multi-layer insulation blanket. The single most recognisable piece of
      // spacecraft visual language there is.
      gold: new THREE.MeshStandardMaterial({
        color: '#caa53d',
        roughness: 0.3,
        metalness: 1,
      }),

      // Pressure glazing. Kept cheap - real transmission is far too expensive
      // for something that appears on every greenhouse.
      glass: new THREE.MeshStandardMaterial({
        color: '#9fd4e0',
        roughness: 0.08,
        metalness: 0.1,
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
      }),

      // Lit interiors seen through ports. Emissive, driven by time of day.
      window: new THREE.MeshStandardMaterial({
        color: '#ffd9a8',
        roughness: 0.25,
        metalness: 0,
        emissive: new THREE.Color('#ffc078'),
        emissiveIntensity: WINDOW_DAY,
      }),

      // Photovoltaic cells: dark, glassy, strongly directional.
      solar: new THREE.MeshStandardMaterial({
        color: '#ffffff',
        map: solarMap,
        roughness: 0.18,
        metalness: 0.82,
      }),

      // Corporate cyan. Faintly emissive so it stays legible at dusk.
      accent: new THREE.MeshStandardMaterial({
        color: '#3fc7d6',
        roughness: 0.4,
        metalness: 0.3,
        emissive: new THREE.Color('#2aa7b8'),
        emissiveIntensity: 0.35,
      }),

      // Obstruction beacons. Blink handled in `update`.
      hazard: new THREE.MeshStandardMaterial({
        color: '#ff6b47',
        roughness: 0.5,
        metalness: 0,
        emissive: new THREE.Color('#ff5024'),
        emissiveIntensity: 1.5,
      }),

      // Regolith-cast foundation pads and landing aprons.
      concrete: new THREE.MeshStandardMaterial({
        color: '#a89482',
        map: concreteMap,
        normalMap: detailNormal,
        normalScale: new THREE.Vector2(0.55, 0.55),
        roughness: 0.96,
        metalness: 0,
      }),

      // Planting beds inside greenhouses - the only green on the planet.
      soil: new THREE.MeshStandardMaterial({
        color: '#4a7a3a',
        roughness: 0.9,
        metalness: 0,
        emissive: new THREE.Color('#183d14'),
        emissiveIntensity: 0.2,
      }),
    };
  }

  get(key: MaterialKey): THREE.MeshStandardMaterial {
    return this.materials[key];
  }

  /**
   * Advances time-of-day driven surfaces.
   *
   * @param delta        seconds since last frame
   * @param nightFactor  0 in full daylight, 1 at full night
   */
  update(delta: number, nightFactor: number): void {
    this.elapsed += delta;

    // Interiors light up as the sun goes down. This is the single strongest
    // signal that the colony is inhabited rather than a model on a shelf.
    this.materials.window.emissiveIntensity =
      WINDOW_DAY + (WINDOW_NIGHT - WINDOW_DAY) * nightFactor;

    this.materials.accent.emissiveIntensity = 0.35 + nightFactor * 0.9;
    this.materials.soil.emissiveIntensity = 0.2 + nightFactor * 0.5;

    // Slow asymmetric blink, brighter and more obvious after dark.
    const blink = Math.sin(this.elapsed * 2.4) * 0.5 + 0.5;
    this.materials.hazard.emissiveIntensity = (0.5 + blink * blink * 2.2) * (0.5 + nightFactor);
  }

  dispose(): void {
    for (const material of Object.values(this.materials)) material.dispose();
    for (const texture of this.textures) texture.dispose();
    this.textures = [];
  }
}

export const MATERIAL_KEYS = Object.keys({
  hull: 0,
  metal: 0,
  dark: 0,
  gold: 0,
  glass: 0,
  window: 0,
  solar: 0,
  accent: 0,
  hazard: 0,
  concrete: 0,
  soil: 0,
} satisfies Record<MaterialKey, number>) as MaterialKey[];
