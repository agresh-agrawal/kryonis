'use client';

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

import { PALETTE, WORLD_SIZE } from '../core/constants';
import type { QualitySettings } from '../core/quality';
import { createRegolithNormalMap } from '../render/textures';
import type { TerrainData } from './terrain';
import {
  createRadialTerrainGeometry,
  terrainBandsFor,
  thetaSegmentsFor,
} from './terrainGeometry';

/**
 * How many world units one repeat of the detail normal map covers.
 *
 * Tight, because this is the only thing standing between the player and a
 * smoothly shaded hillside. Regolith is grain and pebbles at every scale, and
 * the geometry cannot afford to carry that detail.
 */
const DETAIL_TEXTURE_SCALE = 1.75;

const COLOR_REGOLITH_LIGHT = new THREE.Color(PALETTE.regolithLight);
const COLOR_REGOLITH_MID = new THREE.Color(PALETTE.regolithMid);
const COLOR_REGOLITH_DARK = new THREE.Color(PALETTE.regolithDark);
const COLOR_DUST = new THREE.Color(PALETTE.dust);
const COLOR_BASALT = new THREE.Color(PALETTE.basalt);
const COLOR_LAVA = new THREE.Color(PALETTE.lava);
/*
 * Two ice tones rather than one.
 *
 * Clean ice is what sits in shadowed hollows and freshly sublimated patches;
 * dusty ice is what most of a Martian ice field actually looks like, because
 * dust settles on it continuously. Mixing between them by the terrain's own
 * mottle field is what stops an ice sheet reading as a flat sticker.
 */
const COLOR_ICE_CLEAN = new THREE.Color('#d6e6ec');
const COLOR_ICE_DUSTY = new THREE.Color('#9db0b4');
/** Reused per vertex so shading a 90k-vertex mesh allocates nothing. */
const ICE_SCRATCH = new THREE.Color();

/** Grey-blue basaltic sand, the counterweight to the ochre dust. */
const COLOR_BASALT_SAND = new THREE.Color('#6b6357');
/** Deep iron-oxide ochre, for the dustiest regions. */
const COLOR_OCHRE = new THREE.Color('#b26a33');

interface TerrainMeshProps {
  terrain: TerrainData;
  quality: QualitySettings;
}

/**
 * The ground: one continuous displaced disc reaching from the colony to the
 * horizon, shaded by vertex colour and a tiling detail normal map.
 *
 * Resolution follows the quality tier, but gameplay data never does - the
 * simulation always reads the tile grid in `TerrainData`, so lowering graphics
 * settings can never change where you are allowed to build.
 *
 * Surface slope for shading is recovered from the computed vertex normals
 * rather than sampled from the height function. Sampling would mean four extra
 * height evaluations per vertex, and at ~90k vertices with ~27 noise lookups
 * each that is the difference between a fast load and a stall.
 */
export function TerrainMesh({ terrain, quality }: TerrainMeshProps) {
  const geometry = useMemo(() => {
    const geo = createRadialTerrainGeometry({
      bands: terrainBandsFor(quality.terrainSubdivisions),
      thetaSegments: thetaSegmentsFor(quality.terrainSubdivisions),
      uvScale: WORLD_SIZE,
    });

    const position = geo.attributes.position as THREE.BufferAttribute;
    const vertexCount = position.count;
    const { generator } = terrain;

    // Pass 1: displace.
    for (let i = 0; i < vertexCount; i++) {
      position.setY(i, generator.heightAt(position.getX(i), position.getZ(i)));
    }
    position.needsUpdate = true;

    // Normals give us slope for free, and are needed for lighting regardless.
    geo.computeVertexNormals();
    const normal = geo.attributes.normal as THREE.BufferAttribute;

    // Pass 2: shade.
    const colors = new Float32Array(vertexCount * 3);
    // How icy each vertex is, handed to the shader so ice can be *shiny*.
    // Colour alone cannot make ice read as ice: what distinguishes it from pale
    // dust is that it reflects, and reflectance is a material property the
    // vertex colour channel cannot carry.
    const iceness = new Float32Array(vertexCount);
    const scratch = new THREE.Color();

    for (let i = 0; i < vertexCount; i++) {
      const x = position.getX(i);
      const y = position.getY(i);
      const z = position.getZ(i);

      // tan(angle from vertical) recovered from the normal's Y component.
      const ny = Math.max(0.001, normal.getY(i));
      const slope = Math.sqrt(Math.max(0, 1 - ny * ny)) / ny;

      const blend = generator.surfaceBlendAt(x, z, y, slope);

      // Start from regolith varied by fine-grain mottling, then layer the
      // material weights on top in order of visual dominance.
      scratch.copy(COLOR_REGOLITH_MID).lerp(COLOR_REGOLITH_LIGHT, blend.mottle);
      scratch.lerp(COLOR_DUST, blend.dust * 0.85);
      scratch.lerp(COLOR_REGOLITH_DARK, blend.rock * 0.6);
      scratch.lerp(COLOR_BASALT, blend.slopeRock * 0.55);
      scratch.lerp(COLOR_LAVA, blend.lava * 0.9);

      /*
       * Ice.
       *
       * A single flat lerp to one pale blue is what made ice fields look like
       * spilled paint. Real exposed ice on Mars is filthy - dust blows over it
       * constantly, it sublimates unevenly, and it sits in shadowed hollows
       * where it is bluer and in exposed patches where it is nearly white.
       *
       * Two tones mixed by the existing fine mottle field give that variation
       * for free, and the dusty tone keeps it tied to the ground it sits in
       * rather than floating on top as a separate material.
       */
      if (blend.ice > 0.001) {
        const grime = blend.mottle;
        scratch.lerp(
          ICE_SCRATCH.copy(COLOR_ICE_CLEAN).lerp(COLOR_ICE_DUSTY, grime * 0.75),
          blend.ice * 0.94,
        );
      }
      iceness[i] = blend.ice;

      // Broad regional tinting.
      //
      // Real Mars is not one colour: orbital imagery shows huge patches of
      // grey-blue basaltic sand against ochre dust. Sampling a very
      // low-frequency field and pushing the hue either way breaks up the
      // uniform rust that made the ground read as a single flat material.
      const region = generator.regionTintAt(x, z);
      if (region > 0) {
        scratch.lerp(COLOR_BASALT_SAND, region * 0.42);
      } else {
        scratch.lerp(COLOR_OCHRE, -region * 0.38);
      }

      // Height-based lightening: ridges catch more light and collect less dust.
      const exposure = Math.min(1, Math.max(0, (y + 4) / 44));
      scratch.lerp(COLOR_REGOLITH_LIGHT, exposure * 0.16);

      colors[i * 3] = scratch.r;
      colors[i * 3 + 1] = scratch.g;
      colors[i * 3 + 2] = scratch.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aIce', new THREE.BufferAttribute(iceness, 1));
    geo.computeBoundingSphere();

    return geo;
  }, [terrain, quality.terrainSubdivisions]);

  /**
   * Only the normal map survives.
   *
   * A separate roughness map cost a texture unit and pushed the terrain shader
   * past the 16-unit fragment limit on lower-end GPUs, which fails program
   * validation outright and renders the ground black. The grain it contributed
   * is invisible next to what the normal map already does, so it is the obvious
   * thing to cut.
   */
  const normalMap = useMemo(() => {
    const repeat = WORLD_SIZE / DETAIL_TEXTURE_SCALE;
    const normal = createRegolithNormalMap(quality.tier === 'low' ? 256 : 512, terrain.seed);
    normal.repeat.set(repeat, repeat);
    normal.anisotropy = quality.anisotropy;
    return normal;
  }, [terrain.seed, quality.tier, quality.anisotropy]);

  /**
   * The ground material, with ice patched into the standard shader.
   *
   * Roughness has to vary across the surface: dust is completely matte and ice
   * is not, and that difference in *reflectance* is what the eye actually reads
   * as "that is ice". A roughness map would cost a texture unit, and the
   * comment above explains why there is no unit to spare - so the value is
   * carried per-vertex in an attribute instead, which costs one float and no
   * samplers.
   *
   * `onBeforeCompile` is used rather than a custom material so everything else
   * three gives us - shadows, fog, tone mapping, the normal map - keeps
   * working untouched.
   */
  const material = useMemo(() => {
    const standard = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      metalness: 0,
      normalMap,
      normalScale: new THREE.Vector2(1.15, 1.15),
      envMapIntensity: 0.4,
      dithering: true,
    });

    standard.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nattribute float aIce;\nvarying float vIce;',
        )
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvIce = aIce;');

      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vIce;')
        // Ice is smooth and slightly reflective; regolith is neither. Clamping
        // the floor at 0.18 keeps it from becoming a mirror, which would look
        // like polished plastic rather than dirty water ice.
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
          roughnessFactor = mix( roughnessFactor, 0.18, clamp( vIce, 0.0, 1.0 ) );`,
        )
        // A touch of specular lift so the sun catches ice fields at the low
        // angles this game spends most of its day in.
        .replace(
          '#include <metalnessmap_fragment>',
          `#include <metalnessmap_fragment>
          metalnessFactor = mix( metalnessFactor, 0.08, clamp( vIce, 0.0, 1.0 ) );`,
        );
    };

    return standard;
  }, [normalMap]);

  // Geometry, materials and canvas textures are large; release them when the
  // region changes.
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => normalMap.dispose(), [normalMap]);
  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh geometry={geometry} material={material} receiveShadow castShadow name="terrain" />
  );
}
