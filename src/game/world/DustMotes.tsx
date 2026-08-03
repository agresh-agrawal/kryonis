'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import type { QualitySettings } from '../core/quality';
import { Random, deriveSeed } from '../core/rng';
import { createGlowSprite } from '../render/textures';
import { cameraTarget } from '../render/cameraTarget';
import { currentSun } from './sun';

/** Half-extents of the volume of dust kept around the camera focus. */
const FIELD = new THREE.Vector3(90, 26, 90);

/**
 * Airborne dust.
 *
 * Mars has a permanently dusty atmosphere, and a few thousand drifting motes do
 * more for the sense of "thin air over a cold desert" than any amount of extra
 * terrain detail. The field is a fixed box that follows the camera focus and
 * wraps particles around its edges, so a constant particle count covers an
 * unbounded world.
 *
 * Wind speed here is also what a dust-storm event will drive later.
 */
export function DustMotes({
  quality,
  windStrength = 1,
}: {
  quality: QualitySettings;
  windStrength?: number;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.PointsMaterial>(null);
  const count = quality.dustParticles;

  const sprite = useMemo(() => createGlowSprite(64), []);
  useEffect(() => () => sprite.dispose(), [sprite]);

  const { geometry, velocities } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const vels = new Float32Array(count * 3);

    const rand = new Random(deriveSeed(1, 'dust'));
    for (let i = 0; i < count; i++) {
      positions[i * 3] = rand.range(-FIELD.x, FIELD.x);
      positions[i * 3 + 1] = rand.range(-2, FIELD.y);
      positions[i * 3 + 2] = rand.range(-FIELD.z, FIELD.z);

      sizes[i] = rand.range(0.05, 0.42);

      // Mostly horizontal drift with a slow vertical churn.
      vels[i * 3] = rand.range(0.6, 2.6);
      vels[i * 3 + 1] = rand.range(-0.12, 0.3);
      vels[i * 3 + 2] = rand.range(-0.8, 0.8);
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    // The field is re-centred manually each frame; culling it would be wrong.
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 400);

    return { geometry: geo, velocities: vels };
  }, [count]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((_, rawDelta) => {
    const points = pointsRef.current;
    if (!points || count === 0) return;

    const delta = Math.min(rawDelta, 0.1);
    const attribute = geometry.attributes.position as THREE.BufferAttribute;
    const array = attribute.array as Float32Array;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      array[i3] += velocities[i3] * windStrength * delta;
      array[i3 + 1] += velocities[i3 + 1] * windStrength * delta;
      array[i3 + 2] += velocities[i3 + 2] * windStrength * delta;

      // Wrap around the box so the field never empties out downwind.
      if (array[i3] > FIELD.x) array[i3] -= FIELD.x * 2;
      else if (array[i3] < -FIELD.x) array[i3] += FIELD.x * 2;

      if (array[i3 + 2] > FIELD.z) array[i3 + 2] -= FIELD.z * 2;
      else if (array[i3 + 2] < -FIELD.z) array[i3 + 2] += FIELD.z * 2;

      if (array[i3 + 1] > FIELD.y) array[i3 + 1] = -2;
      else if (array[i3 + 1] < -3) array[i3 + 1] = FIELD.y;
    }
    attribute.needsUpdate = true;

    // Particle coordinates are local; move the whole field with the camera.
    points.position.set(cameraTarget.x, cameraTarget.y, cameraTarget.z);

    const material = materialRef.current;
    if (material) {
      // Dust is only visible when something is lighting it.
      material.color.copy(currentSun.horizonColor).lerp(currentSun.color, 0.4);
      material.opacity = 0.05 + (1 - currentSun.nightFactor) * 0.22;
    }
  });

  if (count === 0) return null;

  return (
    <points ref={pointsRef} geometry={geometry} frustumCulled={false} name="dust">
      <pointsMaterial
        ref={materialRef}
        map={sprite}
        size={0.55}
        sizeAttenuation
        transparent
        opacity={0.2}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}
