'use client';

import { useEffect, useMemo, useRef, type ComponentRef } from 'react';
import { MapControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { VALLEY_FLOOR_RADIUS } from '../core/constants';
import type { TerrainData } from '../world/terrain';
import { cameraTarget } from './cameraTarget';

type MapControlsRef = ComponentRef<typeof MapControls>;

/**
 * The focus point is confined to the crater floor.
 *
 * This is the camera half of the same idea the terrain expresses physically:
 * the player is in this valley. Letting the view drift out over the rim would
 * show them a world they can never reach and immediately raise the question of
 * why not.
 */
const FOCUS_RADIUS = VALLEY_FLOOR_RADIUS + 6;

const MIN_DISTANCE = 10;
const MAX_DISTANCE = 235;

/**
 * How far the camera must stay above the ground beneath it.
 *
 * Without this the camera sinks straight through the crater wall when the
 * player orbits toward it, and the view ends up inside solid rock. Lifting the
 * camera instead of blocking the orbit is the standard fix for a strategy
 * camera: the view rides up and over the obstruction rather than jamming.
 */
const GROUND_CLEARANCE = 3;

/** Keep the horizon visible - never let the player look flat along the ground. */
const MIN_POLAR = 0.12;
const MAX_POLAR = 1.32;

const KEY_PAN_SPEED = 42;
const KEY_ROTATE_SPEED = 1.6;

/**
 * The player's camera: pan, zoom and orbit over the colony.
 *
 * Built on MapControls (drag to pan, wheel to zoom, right-drag to orbit, and
 * the expected one/two-finger touch equivalents) with three additions that
 * matter for a builder on uneven ground:
 *
 *  - the focus point rides the terrain height, so panning up a mesa does not
 *    bury the camera inside it;
 *  - the focus is clamped to the region so the colony can never be lost
 *    off-screen;
 *  - WASD pans and Q/E orbit, because strategy players reach for them.
 */
export function CameraRig({ terrain }: { terrain: TerrainData }) {
  const controlsRef = useRef<MapControlsRef>(null);
  const camera = useThree((state) => state.camera);

  const keys = useMemo(() => new Set<string>(), []);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      // Never steal keys while the player is typing into the HUD.
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
      keys.add(event.code);
    };
    const up = (event: KeyboardEvent) => keys.delete(event.code);
    const blur = () => keys.clear();

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [keys]);

  // Scratch vectors reused every frame to avoid per-frame allocation.
  const scratch = useMemo(
    () => ({
      forward: new THREE.Vector3(),
      right: new THREE.Vector3(),
      offset: new THREE.Vector3(),
      move: new THREE.Vector3(),
      up: new THREE.Vector3(0, 1, 0),
    }),
    [],
  );

  useFrame((_, rawDelta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    // Clamp delta so an alt-tab pause does not fling the camera across the map.
    const delta = Math.min(rawDelta, 0.1);
    const target = controls.target;

    // Pan speed scales with zoom: fine control up close, fast travel far out.
    const distance = camera.position.distanceTo(target);
    const panSpeed = KEY_PAN_SPEED * delta * THREE.MathUtils.clamp(distance / 60, 0.35, 2.4);

    scratch.forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
    scratch.forward.y = 0;
    scratch.forward.normalize();
    scratch.right.crossVectors(scratch.forward, scratch.up).normalize().negate();

    scratch.move.set(0, 0, 0);
    if (keys.has('KeyW') || keys.has('ArrowUp')) scratch.move.add(scratch.forward);
    if (keys.has('KeyS') || keys.has('ArrowDown')) scratch.move.sub(scratch.forward);
    if (keys.has('KeyD') || keys.has('ArrowRight')) scratch.move.add(scratch.right);
    if (keys.has('KeyA') || keys.has('ArrowLeft')) scratch.move.sub(scratch.right);

    if (scratch.move.lengthSq() > 0) {
      scratch.move.normalize().multiplyScalar(panSpeed);
      target.add(scratch.move);
      camera.position.add(scratch.move);
    }

    // Q/E orbit by rotating the camera around the focus point. MapControls has
    // no public API for this, so the offset is rotated directly.
    let rotation = 0;
    if (keys.has('KeyQ')) rotation += KEY_ROTATE_SPEED * delta;
    if (keys.has('KeyE')) rotation -= KEY_ROTATE_SPEED * delta;
    if (rotation !== 0) {
      scratch.offset.copy(camera.position).sub(target);
      scratch.offset.applyAxisAngle(scratch.up, rotation);
      camera.position.copy(target).add(scratch.offset);
    }

    // Keep the focus inside the crater, clamping radially so the boundary is
    // a circle that matches the valley rather than a square that fights it.
    const radius = Math.hypot(target.x, target.z);
    if (radius > FOCUS_RADIUS) {
      const scale = FOCUS_RADIUS / radius;
      const newX = target.x * scale;
      const newZ = target.z * scale;
      camera.position.x += newX - target.x;
      camera.position.z += newZ - target.z;
      target.x = newX;
      target.z = newZ;
    }

    // Ride the terrain surface. Smoothed so cliff edges glide rather than snap.
    const groundHeight = terrain.generator.heightAt(target.x, target.z);
    const heightDelta = (groundHeight - target.y) * Math.min(1, delta * 6);
    if (Math.abs(heightDelta) > 1e-4) {
      target.y += heightDelta;
      camera.position.y += heightDelta;
    }

    // Terrain collision. Sampling a few points between the camera and its
    // focus - not just the camera position - stops the near clip plane from
    // cutting into a slope that the camera itself has cleared.
    let requiredY = terrain.generator.heightAt(camera.position.x, camera.position.z);
    for (const t of [0.12, 0.26]) {
      const sampleX = camera.position.x + (target.x - camera.position.x) * t;
      const sampleZ = camera.position.z + (target.z - camera.position.z) * t;
      const sampled = terrain.generator.heightAt(sampleX, sampleZ);
      if (sampled > requiredY) requiredY = sampled;
    }
    requiredY += GROUND_CLEARANCE;

    if (camera.position.y < requiredY) {
      camera.position.y = requiredY;
    }

    cameraTarget.copy(target);
  });

  return (
    <MapControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.09}
      screenSpacePanning={false}
      minDistance={MIN_DISTANCE}
      maxDistance={MAX_DISTANCE}
      minPolarAngle={MIN_POLAR}
      maxPolarAngle={MAX_POLAR}
      zoomSpeed={0.9}
      rotateSpeed={0.55}
      panSpeed={1.1}
      // Keep the wheel from scrolling the page behind the canvas on trackpads.
      zoomToCursor
    />
  );
}
