'use client';

import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import type { QualitySettings } from '../core/quality';
import { currentMoons, currentSun } from '../world/sun';
import { cameraTarget } from './cameraTarget';

/** How far up the sun light sits from the terrain it shadows. */
const SUN_DISTANCE = 320;

/**
 * Scene lighting: one shadow-casting sun, a hemisphere fill representing light
 * scattered by suspended dust, and a weak bounce light opposite the sun.
 *
 * The shadow camera follows the player's view instead of covering the whole
 * region - a 128-unit map with a 4k shadow map would waste most of its
 * resolution on terrain nobody is looking at.
 */
export function Lighting({ quality }: { quality: QualitySettings }) {
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const moonRef = useRef<THREE.DirectionalLight>(null);
  const hemisphereRef = useRef<THREE.HemisphereLight>(null);
  const targetRef = useRef<THREE.Object3D>(null);

  // Wire the light at its target object once; three needs an Object3D, not a
  // position, to aim a directional light.
  useEffect(() => {
    if (sunRef.current && targetRef.current) {
      sunRef.current.target = targetRef.current;
    }
    if (moonRef.current && targetRef.current) {
      moonRef.current.target = targetRef.current;
    }
  }, []);

  useEffect(() => {
    const light = sunRef.current;
    if (!light) return;

    const d = quality.shadowDistance;
    const camera = light.shadow.camera;
    camera.left = -d;
    camera.right = d;
    camera.top = d;
    camera.bottom = -d;
    camera.near = SUN_DISTANCE - 200;
    camera.far = SUN_DISTANCE + 260;
    camera.updateProjectionMatrix();
  }, [quality.shadowDistance, quality.shadowMapSize]);

  useFrame(() => {
    const light = sunRef.current;
    const target = targetRef.current;
    if (!light || !target) return;

    // Keep the lit volume centred on whatever the player is looking at.
    target.position.copy(cameraTarget);
    target.updateMatrixWorld();

    light.position.copy(cameraTarget).addScaledVector(currentSun.direction, SUN_DISTANCE);
    light.color.copy(currentSun.color);
    light.intensity = currentSun.intensity;
    // Below the horizon the sun should not light or shadow anything.
    light.visible = currentSun.elevation > -0.05;

    // The single fill light. By night it is moonlight from whichever moon is
    // higher; by day it is the dust-scattered bounce from behind the sun.
    const fill = moonRef.current;
    if (fill) {
      const phobos = currentMoons.phobos;
      const deimos = currentMoons.deimos;
      const dominant = phobos.brightness >= deimos.brightness ? phobos : deimos;

      if (dominant.brightness > 0.02) {
        fill.position.copy(cameraTarget).addScaledVector(dominant.direction, SUN_DISTANCE);
        fill.color.set('#aac4f0');
        fill.intensity = dominant.brightness * 0.85;
      } else {
        fill.position
          .copy(cameraTarget)
          .addScaledVector(currentSun.direction, -SUN_DISTANCE * 0.5)
          .setY(cameraTarget.y + 60);
        fill.color.copy(currentSun.horizonColor);
        fill.intensity = currentSun.ambientIntensity * 0.5;
      }
    }

    const hemisphere = hemisphereRef.current;
    if (hemisphere) {
      hemisphere.color.copy(currentSun.zenithColor);
      hemisphere.groundColor.copy(currentSun.horizonColor).multiplyScalar(0.45);
      hemisphere.intensity = currentSun.ambientIntensity;
    }
  });

  return (
    <>
      <object3D ref={targetRef} />

      <directionalLight
        ref={sunRef}
        castShadow={quality.shadows}
        shadow-mapSize-width={quality.shadowMapSize}
        shadow-mapSize-height={quality.shadowMapSize}
        shadow-bias={-0.0006}
        shadow-normalBias={0.045}
      />

      {/*
        One fill light, not two.

        Moonlight and the dust-scattered bounce used to be separate directional
        lights. Every extra light compiles into every material's fragment
        shader whether or not it contributes anything, so the pair have been
        merged into this one: it carries moonlight when a moon is up and the
        bounce colour otherwise.
      */}
      <directionalLight ref={moonRef} intensity={0} />

      <hemisphereLight ref={hemisphereRef} />

      {/* A floor of ambient so night-side detail never goes fully black. */}
      <ambientLight intensity={0.16} color="#6d6a94" />
    </>
  );
}
