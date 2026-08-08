'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { TILE_SIZE, VALLEY_FLOOR_RADIUS } from '../core/constants';
import { useColonyStore } from '../state/useColonyStore';
import type { TerrainData } from '../world/terrain';
import { createRadialTerrainGeometry } from '../world/terrainGeometry';

const vertexShader = /* glsl */ `
  varying vec3 vWorld;

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTile;
  uniform float uRadius;
  uniform float uOpacity;
  uniform vec3 uColor;
  uniform vec3 uEdgeColor;

  varying vec3 vWorld;

  // Screen-space-aware line: keeps the grid one pixel wide at any zoom instead
  // of dissolving into moire when the camera pulls back.
  float gridLine(vec2 coord) {
    vec2 grid = abs(fract(coord - 0.5) - 0.5) / fwidth(coord);
    return 1.0 - min(min(grid.x, grid.y), 1.0);
  }

  void main() {
    float radius = length(vWorld.xz);

    // Fade the grid out as it approaches the edge of claimed territory.
    float inside = 1.0 - smoothstep(uRadius - 3.0, uRadius, radius);

    // A bright ring marks the perimeter itself.
    float edge = 1.0 - smoothstep(0.0, 1.2, abs(radius - uRadius));

    float line = gridLine(vWorld.xz / uTile);

    vec3 color = mix(uColor, uEdgeColor, edge);
    float alpha = (line * 0.5 * inside + edge * 0.85) * uOpacity;
    if (alpha < 0.004) discard;

    gl_FragColor = vec4(color, alpha);
  }
`;

/**
 * The build grid.
 *
 * Drawn as a low-resolution copy of the terrain surface floated a few
 * centimetres above the ground, so the grid follows every rise and dip instead
 * of being a flat plane slicing through hills. It fades in only while the build
 * tool is active - a permanent grid would fight the naturalistic surface the
 * rest of the scene works to produce.
 */
export function BuildGrid({ terrain, active }: { terrain: TerrainData; active: boolean }) {
  const unlockedRadius = useColonyStore((state) => state.unlockedRadius);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const geometry = useMemo(() => {
    const geo = createRadialTerrainGeometry({
      bands: [{ radius: VALLEY_FLOOR_RADIUS + 6, rings: 110 }],
      thetaSegments: 220,
      uvScale: 1,
    });

    const position = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const z = position.getZ(i);
      // Lift slightly to avoid z-fighting with the ground it traces.
      position.setY(i, terrain.generator.heightAt(x, z) + 0.07);
    }
    position.needsUpdate = true;
    geo.computeBoundingSphere();
    return geo;
  }, [terrain]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  const uniforms = useMemo(
    () => ({
      uTile: { value: TILE_SIZE },
      uRadius: { value: unlockedRadius },
      uOpacity: { value: 0 },
      uColor: { value: new THREE.Color('#4fd6e0') },
      uEdgeColor: { value: new THREE.Color('#8ff5ff') },
    }),
    [],
  );

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    uniforms.uRadius.value = unlockedRadius;
    // Ease in and out so toggling the build tool does not snap.
    const target = active ? 1 : 0;
    uniforms.uOpacity.value += (target - uniforms.uOpacity.value) * Math.min(1, delta * 9);
  });

  return (
    <mesh geometry={geometry} renderOrder={5} frustumCulled={false} name="build-grid">
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        toneMapped={false}
        fog={false}
      />
    </mesh>
  );
}
