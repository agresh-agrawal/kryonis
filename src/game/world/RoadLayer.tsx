'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { REGION_TILES, TILE_SIZE, WORLD_HALF } from '../core/constants';
import { useRoadStore } from '../state/useRoadStore';
import { hasRoad, networkAt, roadGrid, tileUtilities } from './roads';
import type { TerrainData } from './terrain';

/**
 * The colony's pressurised walkways.
 *
 * These are not roads in the tarmac sense and they should not look like one.
 * Nobody strolls across Mars in shirtsleeves: the way people move between
 * sectors is a sealed tube with air in it, and that is what these are - a
 * glazed arch over a walking deck, with the power and water runs carried in
 * the service duct beneath the floor where a real installation would put them.
 *
 * The wiring is deliberately **hidden until asked for**. A colony with every
 * conduit glowing all the time is a Christmas tree, and the one moment a player
 * actually wants to see cabling is when they are working out why a sector is
 * dark. So the ducts are dim and unlit normally, and the utility overlay - or
 * selecting a walkway - lights them up and makes the tube glass go transparent
 * so you can see straight through to them.
 */

/** Height of the walking deck above the ground. */
const DECK_HEIGHT = 0.08;
/** Radius of the pressurised arch. */
const ARCH_RADIUS = 0.78;
/** How far the conduits sit either side of the centre line, under the deck. */
const DUCT_OFFSET = 0.42;
const DUCT_RADIUS = 0.06;

export function RoadLayer({ terrain }: { terrain: TerrainData }) {
  const version = useRoadStore((state) => state.version);
  const showUtilities = useRoadStore((state) => state.showUtilities);

  const glassRef = useRef<THREE.MeshStandardMaterial>(null);
  const powerRef = useRef<THREE.MeshStandardMaterial>(null);
  const waterRef = useRef<THREE.MeshStandardMaterial>(null);

  /*
   * Rebuilt whenever the grid changes rather than patched incrementally.
   *
   * A colony tops out at a few hundred walkway tiles, so a full rebuild is a
   * couple of milliseconds and only happens when the player lays or removes
   * one. Incremental patching would be faster and would be the wrong trade:
   * far more state to keep correct, for time nobody was spending.
   */
  const geometry = useMemo(() => {
    const decks: THREE.BufferGeometry[] = [];
    const arches: THREE.BufferGeometry[] = [];
    const ribs: THREE.BufferGeometry[] = [];
    const poweredDucts: THREE.BufferGeometry[] = [];
    const deadPowerDucts: THREE.BufferGeometry[] = [];
    const wateredDucts: THREE.BufferGeometry[] = [];
    const deadWaterDucts: THREE.BufferGeometry[] = [];

    for (let index = 0; index < roadGrid.length; index++) {
      if (roadGrid[index] !== 1) continue;

      const tx = index % REGION_TILES;
      const tz = (index / REGION_TILES) | 0;
      const x = (tx + 0.5) * TILE_SIZE - WORLD_HALF;
      const z = (tz + 0.5) * TILE_SIZE - WORLD_HALF;
      const y = terrain.generator.heightAt(x, z);

      const east = hasRoad(tx + 1, tz);
      const west = hasRoad(tx - 1, tz);
      const north = hasRoad(tx, tz - 1);
      const south = hasRoad(tx, tz + 1);

      const runsX = east || west;
      const runsZ = north || south;
      // A lone tile still gets an axis, or a single piece would be a bare slab.
      const axes: ('x' | 'z')[] = [];
      if (runsX) axes.push('x');
      if (runsZ) axes.push('z');
      if (axes.length === 0) axes.push('x');

      // --- Walking deck ---------------------------------------------------
      const deck = new THREE.BoxGeometry(TILE_SIZE * 1.02, 0.07, TILE_SIZE * 1.02);
      deck.translate(x, y + DECK_HEIGHT, z);
      decks.push(deck);

      const { power, water } = tileUtilities(tx, tz);

      for (const axis of axes) {
        // --- Pressurised arch ---------------------------------------------
        // An open half-cylinder, so from a low camera you see into the tube
        // rather than at a sealed lozenge.
        const arch = new THREE.CylinderGeometry(
          ARCH_RADIUS,
          ARCH_RADIUS,
          TILE_SIZE * 1.02,
          14,
          1,
          true,
          0,
          Math.PI,
        );
        arch.rotateZ(Math.PI / 2);
        if (axis === 'z') arch.rotateY(Math.PI / 2);
        arch.translate(x, y + DECK_HEIGHT, z);
        arches.push(arch);

        // Structural hoops at each end of the tile, so a run reads as a
        // sequence of frames rather than an extruded pipe.
        for (const end of [-0.5, 0.5]) {
          const hoop = new THREE.TorusGeometry(ARCH_RADIUS, 0.035, 6, 14, Math.PI);
          hoop.rotateZ(Math.PI);
          if (axis === 'x') {
            hoop.rotateY(Math.PI / 2);
            hoop.translate(x + end * TILE_SIZE, y + DECK_HEIGHT, z);
          } else {
            hoop.translate(x, y + DECK_HEIGHT, z + end * TILE_SIZE);
          }
          ribs.push(hoop);
        }

        // --- Service ducts under the deck ----------------------------------
        for (const [offset, live, deadList, liveList] of [
          [-DUCT_OFFSET, power, deadPowerDucts, poweredDucts] as const,
          [DUCT_OFFSET, water, deadWaterDucts, wateredDucts] as const,
        ]) {
          const duct = new THREE.CylinderGeometry(
            DUCT_RADIUS,
            DUCT_RADIUS,
            TILE_SIZE * 1.02,
            6,
          );
          if (axis === 'x') {
            duct.rotateZ(Math.PI / 2);
            duct.translate(x, y + DECK_HEIGHT - 0.05, z + offset);
          } else {
            duct.rotateX(Math.PI / 2);
            duct.translate(x + offset, y + DECK_HEIGHT - 0.05, z);
          }
          (live ? liveList : deadList).push(duct);
        }
      }
    }

    const merge = (list: THREE.BufferGeometry[]) => {
      if (list.length === 0) return null;
      const merged = list.length === 1 ? list[0] : mergeGeometries(list, false);
      if (merged && list.length > 1) for (const g of list) g.dispose();
      return merged;
    };

    return {
      deck: merge(decks),
      arch: merge(arches),
      ribs: merge(ribs),
      powered: merge(poweredDucts),
      deadPower: merge(deadPowerDucts),
      watered: merge(wateredDucts),
      deadWater: merge(deadWaterDucts),
    };
    // `version` is the signal that the grid changed; the grid is not reactive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, terrain]);

  useEffect(() => {
    return () => {
      for (const geo of Object.values(geometry)) geo?.dispose();
    };
  }, [geometry]);

  /*
   * Inspection mode.
   *
   * Turning the overlay on does two things at once, and both are necessary:
   * the glass loses most of its opacity so the ducts underneath become
   * visible, and the live ducts light up. Either alone would be half an
   * answer - glowing cable you cannot see through to is no help, and clear
   * glass over dark cable tells you nothing about which run is carrying.
   */
  useFrame(({ clock }) => {
    const pulse = 0.7 + Math.sin(clock.elapsedTime * 1.8) * 0.3;

    if (glassRef.current) {
      const target = showUtilities ? 0.12 : 0.34;
      glassRef.current.opacity += (target - glassRef.current.opacity) * 0.12;
    }
    if (powerRef.current) {
      powerRef.current.emissiveIntensity = showUtilities ? pulse * 2.4 : 0.25;
    }
    if (waterRef.current) {
      waterRef.current.emissiveIntensity = showUtilities ? pulse * 2.0 : 0.2;
    }
  });

  if (!geometry.deck) return null;

  return (
    <group name="walkways">
      {/* Walking deck: sintered regolith, the surface people actually stand on. */}
      <mesh geometry={geometry.deck} receiveShadow>
        <meshStandardMaterial color="#6b5c4e" roughness={0.92} metalness={0.02} />
      </mesh>

      {/* Structural hoops. */}
      {geometry.ribs ? (
        <mesh geometry={geometry.ribs} castShadow>
          <meshStandardMaterial color="#b9c3cc" roughness={0.42} metalness={0.75} />
        </mesh>
      ) : null}

      {/*
        The pressurised shell.
        Double-sided because it is an open half-cylinder and the camera spends
        most of its time looking down into it.
      */}
      {geometry.arch ? (
        <mesh geometry={geometry.arch}>
          <meshStandardMaterial
            ref={glassRef}
            color="#9fd4e0"
            transparent
            opacity={0.34}
            roughness={0.1}
            metalness={0.1}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ) : null}

      {/* --- Service ducts: power (yellow), water (blue) ----------------- */}
      {geometry.powered ? (
        <mesh geometry={geometry.powered}>
          <meshStandardMaterial
            ref={powerRef}
            color="#f0c657"
            emissive="#f0c657"
            emissiveIntensity={0.25}
            roughness={0.4}
            metalness={0.3}
          />
        </mesh>
      ) : null}
      {geometry.deadPower ? (
        <mesh geometry={geometry.deadPower}>
          <meshStandardMaterial color="#4a422f" roughness={0.8} metalness={0.2} />
        </mesh>
      ) : null}

      {geometry.watered ? (
        <mesh geometry={geometry.watered}>
          <meshStandardMaterial
            ref={waterRef}
            color="#4fa8e0"
            emissive="#4fa8e0"
            emissiveIntensity={0.2}
            roughness={0.35}
            metalness={0.3}
          />
        </mesh>
      ) : null}
      {geometry.deadWater ? (
        <mesh geometry={geometry.deadWater}>
          <meshStandardMaterial color="#2c4150" roughness={0.8} metalness={0.2} />
        </mesh>
      ) : null}
    </group>
  );
}

/** Which network a world position sits on, for click-to-inspect. */
export function networkAtWorld(x: number, z: number): number {
  const tx = Math.floor((x + WORLD_HALF) / TILE_SIZE);
  const tz = Math.floor((z + WORLD_HALF) / TILE_SIZE);
  return networkAt(tx, tz);
}
