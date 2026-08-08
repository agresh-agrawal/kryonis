'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { TILE_SIZE, WORLD_HALF } from '../core/constants';
import { BUILDINGS, getBuildingModel, rotatedFootprint } from '../buildings/catalog';
import type { MaterialKey } from '../buildings/materials';
import { useBuildStore } from '../state/useBuildStore';
import { ROAD_REFUSAL_TEXT, useRoadStore } from '../state/useRoadStore';
import { occupantAt, useColonyStore, type PlacementCheck } from '../state/useColonyStore';
import { gradeAt } from '../world/roads';
import { worldToTile, type TerrainData } from '../world/terrain';

const VALID_COLOR = new THREE.Color('#4fe08a');
const INVALID_COLOR = new THREE.Color('#ff5f42');

/**
 * Turns pointer position into building placement.
 *
 * The ground is picked with a mathematical ray/plane intersection refined
 * against the height field rather than by raycasting the terrain mesh. At ~90k
 * triangles a mesh raycast every frame is genuinely expensive, and the height
 * function gives an exact answer for a few dozen arithmetic operations.
 */
export function PlacementController({ terrain }: { terrain: TerrainData }) {
  const { camera, raycaster, pointer, gl } = useThree();

  const tool = useBuildStore((state) => state.tool);
  const selectedType = useBuildStore((state) => state.selectedType);
  const rotation = useBuildStore((state) => state.rotation);
  const rotate = useBuildStore((state) => state.rotate);
  const cancel = useBuildStore((state) => state.cancel);
  const setHint = useBuildStore((state) => state.setHint);

  const place = useColonyStore((state) => state.place);
  const select = useColonyStore((state) => state.select);
  const demolish = useColonyStore((state) => state.demolish);

  const [hover, setHover] = useState<{ tx: number; tz: number } | null>(null);
  const checkRef = useRef<PlacementCheck | null>(null);

  const ghostGroup = useRef<THREE.Group>(null);
  const footprintRef = useRef<THREE.Mesh>(null);

  const ghostMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: VALID_COLOR,
        transparent: true,
        opacity: 0.45,
        roughness: 0.4,
        metalness: 0.1,
        emissive: VALID_COLOR.clone(),
        emissiveIntensity: 0.35,
        depthWrite: false,
      }),
    [],
  );

  const footprintMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: VALID_COLOR,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );

  useEffect(
    () => () => {
      ghostMaterial.dispose();
      footprintMaterial.dispose();
    },
    [ghostMaterial, footprintMaterial],
  );

  /**
   * Intersects the pointer ray with the terrain.
   *
   * March along the ray until it passes below the height field, then bisect.
   * Robust on steep crater walls where a single plane intersection would be
   * badly wrong.
   */
  const pickGround = useMemo(() => {
    const origin = new THREE.Vector3();
    const direction = new THREE.Vector3();
    const point = new THREE.Vector3();

    return (): THREE.Vector3 | null => {
      raycaster.setFromCamera(pointer, camera);
      origin.copy(raycaster.ray.origin);
      direction.copy(raycaster.ray.direction);

      if (direction.y > -0.001) return null;

      let previous = 0;
      let previousDelta = origin.y - terrain.generator.heightAt(origin.x, origin.z);

      const maxDistance = 600;
      const step = 2.5;
      for (let travelled = step; travelled < maxDistance; travelled += step) {
        point.copy(origin).addScaledVector(direction, travelled);
        const delta = point.y - terrain.generator.heightAt(point.x, point.z);

        if (delta <= 0 && previousDelta > 0) {
          // Bisect between the last two samples for a precise hit.
          let low = previous;
          let high = travelled;
          for (let i = 0; i < 12; i++) {
            const mid = (low + high) / 2;
            point.copy(origin).addScaledVector(direction, mid);
            const midDelta = point.y - terrain.generator.heightAt(point.x, point.z);
            if (midDelta > 0) low = mid;
            else high = mid;
          }
          point.copy(origin).addScaledVector(direction, (low + high) / 2);
          return point;
        }

        previous = travelled;
        previousDelta = delta;
      }

      return null;
    };
  }, [camera, pointer, raycaster, terrain]);

  // Keyboard: R rotates the ghost, Escape puts the tool away.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
      if (event.code === 'KeyR') rotate();
      else if (event.code === 'Escape') cancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [rotate, cancel]);

  // Commit on click. Bound to the canvas so HUD clicks never place a building.
  useEffect(() => {
    const canvas = gl.domElement;

    let downAt: { x: number; y: number } | null = null;

    /*
     * Road drawing is a drag, not a click.
     *
     * Nobody lays a road one tile at a time, and making them try is the fastest
     * way to make a good system feel like a chore. Holding the button paints a
     * run; every tile the cursor crosses is laid, and tiles are de-duplicated so
     * dragging back over your own work does not charge twice.
     */
    let painting: 'lay' | 'erase' | null = null;
    const paintedThisDrag = new Set<number>();

    const paintAt = (): void => {
      const ground = pickGround();
      if (!ground) return;
      const [tx, tz] = worldToTile(ground.x, ground.z);
      const key = tz * 4096 + tx;
      if (paintedThisDrag.has(key)) return;
      paintedThisDrag.add(key);

      const roads = useRoadStore.getState();
      const build = useBuildStore.getState();

      if (painting === 'erase') {
        roads.remove(tx, tz);
        build.setHint(null, true);
        return;
      }

      // A refusal is worth saying out loud. Painting a run that silently stops
      // at your perimeter, or at a cliff, or when the credits run out, is the
      // kind of thing a player blames on the controls.
      const refusal = roads.lay(tx, tz);
      if (refusal === 'already') build.setHint(null, true);
      else build.setHint(refusal ? ROAD_REFUSAL_TEXT[refusal] : null, !refusal);
    };

    const onPointerMove = () => {
      if (painting) paintAt();
    };

    const onPointerDown = (event: PointerEvent) => {
      downAt = { x: event.clientX, y: event.clientY };

      const state = useBuildStore.getState();
      if (state.tool !== 'road' || event.button !== 0) return;

      /*
       * One tool, and the thing under the cursor decides which way it works.
       *
       * Starting on bare ground lays. Starting on a road of a *lower* grade
       * upgrades it, which is how a colony gets sealed a run at a time. Starting
       * on a road already at the selected grade is the only way to mean "take
       * this up", so that is what it does.
       */
      const ground = pickGround();
      if (!ground) return;
      const [tx, tz] = worldToTile(ground.x, ground.z);
      painting = gradeAt(tx, tz) === useRoadStore.getState().grade ? 'erase' : 'lay';
      paintedThisDrag.clear();
      paintAt();
    };

    const onPointerUp = (event: PointerEvent) => {
      if (painting) {
        painting = null;
        paintedThisDrag.clear();
        downAt = null;
        return;
      }

      if (!downAt) return;
      // Ignore clicks that were really camera drags.
      const moved = Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y);
      downAt = null;
      if (moved > 5 || event.button !== 0) return;

      const state = useBuildStore.getState();

      if (state.tool === 'build' && state.selectedType) {
        const check = checkRef.current;
        const target = hoverRef.current;
        if (check?.valid && target) {
          place(terrain, state.selectedType, target.tx, target.tz, state.rotation);
        }
        return;
      }

      // Select or demolish whatever is under the cursor.
      const ground = pickGround();
      if (!ground) {
        select(null);
        return;
      }
      const [tx, tz] = worldToTile(ground.x, ground.z);
      const occupant = occupantAt(tx, tz);
      if (occupant === 0) {
        select(null);
        return;
      }
      const building = useColonyStore.getState().buildings[occupant - 1];
      if (!building) return;

      if (state.tool === 'demolish') {
        if (building.type !== 'lander') demolish(building.id);
      } else {
        select(building.id);
      }
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
    };
  }, [gl, place, select, demolish, terrain, pickGround]);

  // Mirror hover into a ref so the pointer handler above reads it without
  // re-subscribing on every mouse move.
  const hoverRef = useRef<{ tx: number; tz: number } | null>(null);
  hoverRef.current = hover;

  const checkPlacement = useColonyStore((state) => state.checkPlacement);

  useFrame(() => {
    const building = ghostGroup.current;
    const footprint = footprintRef.current;

    /*
     * The road tool gets a cursor too.
     *
     * It used to have none: you dragged across the crater and tiles either
     * appeared or did not, with no indication of which tile you were over or
     * whether it would take a road. A one-tile square under the pointer, in the
     * same green and red the build ghost uses, makes the road tool feel like
     * the same tool as the rest of the builder.
     */
    if (tool === 'road') {
      if (building) building.visible = false;

      const ground = pickGround();
      if (!ground || !footprint) {
        if (footprint) footprint.visible = false;
        return;
      }

      const [tx, tz] = worldToTile(ground.x, ground.z);
      const refusal = useRoadStore.getState().check(tx, tz);
      // `already` is not a refusal worth colouring red: it means the tile is
      // finished, and dragging over your own finished work is normal.
      const valid = refusal === null || refusal === 'already';
      setHint(refusal && refusal !== 'already' ? ROAD_REFUSAL_TEXT[refusal] : null, valid);

      const colour = valid ? VALID_COLOR : INVALID_COLOR;
      footprintMaterial.color.copy(colour);

      footprint.visible = true;
      footprint.position.set(
        (tx + 0.5) * TILE_SIZE - WORLD_HALF,
        terrain.generator.heightAt(
          (tx + 0.5) * TILE_SIZE - WORLD_HALF,
          (tz + 0.5) * TILE_SIZE - WORLD_HALF,
        ) + 0.14,
        (tz + 0.5) * TILE_SIZE - WORLD_HALF,
      );
      footprint.scale.set(TILE_SIZE * 0.94, TILE_SIZE * 0.94, 1);
      return;
    }

    if (tool !== 'build' || !selectedType) {
      if (building) building.visible = false;
      if (footprint) footprint.visible = false;
      if (hover) setHover(null);
      return;
    }

    const ground = pickGround();
    if (!ground) {
      if (building) building.visible = false;
      if (footprint) footprint.visible = false;
      return;
    }

    const [w, d] = rotatedFootprint(selectedType, rotation);

    // Centre the footprint on the cursor rather than anchoring its corner.
    const anchorX = Math.round((ground.x + WORLD_HALF) / TILE_SIZE - w / 2);
    const anchorZ = Math.round((ground.z + WORLD_HALF) / TILE_SIZE - d / 2);

    if (!hover || hover.tx !== anchorX || hover.tz !== anchorZ) {
      setHover({ tx: anchorX, tz: anchorZ });
    }

    const check = checkPlacement(terrain, selectedType, anchorX, anchorZ, rotation);
    checkRef.current = check;
    setHint(check.valid ? null : check.message, check.valid);

    const color = check.valid ? VALID_COLOR : INVALID_COLOR;
    ghostMaterial.color.copy(color);
    ghostMaterial.emissive.copy(color);
    footprintMaterial.color.copy(color);

    const centreX = (anchorX + w / 2) * TILE_SIZE - WORLD_HALF;
    const centreZ = (anchorZ + d / 2) * TILE_SIZE - WORLD_HALF;

    if (building) {
      building.visible = true;
      building.position.set(centreX, check.groundY, centreZ);
      building.rotation.y = (rotation * Math.PI) / 2;
    }

    if (footprint) {
      footprint.visible = true;
      footprint.position.set(centreX, check.groundY + 0.12, centreZ);
      footprint.scale.set(w * TILE_SIZE * 0.97, d * TILE_SIZE * 0.97, 1);
    }
  });

  const ghostModel = useMemo(
    () => (selectedType ? getBuildingModel(selectedType) : null),
    [selectedType],
  );

  return (
    <>
      <group ref={ghostGroup} visible={false} name="placement-ghost">
        {ghostModel
          ? (Object.keys(ghostModel) as MaterialKey[]).map((key) => {
              const geometry = ghostModel[key];
              if (!geometry) return null;
              return <mesh key={key} geometry={geometry} material={ghostMaterial} />;
            })
          : null}
      </group>

      <mesh
        ref={footprintRef}
        visible={false}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={6}
        name="placement-footprint"
      >
        <planeGeometry args={[1, 1]} />
        <primitive object={footprintMaterial} attach="material" />
      </mesh>
    </>
  );
}
