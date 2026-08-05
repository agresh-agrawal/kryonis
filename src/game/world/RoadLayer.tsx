'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { TILE_SIZE, WORLD_HALF } from '../core/constants';
import { useRoadStore } from '../state/useRoadStore';
import { networkAt, roadGrid, tileUtilities } from './roads';
import {
  ARCH_RADIUS,
  DECK_LIFT,
  archStub,
  connectionsOf,
  deckQuad,
  ductStub,
  forEachRoadTile,
  isStraightThrough,
  tileWorld,
  type Direction,
} from './walkwayGeometry';
import type { TerrainData } from './terrain';

/**
 * The colony's pressurised walkways.
 *
 * Nobody crosses Mars in shirtsleeves, so what joins two sectors is a sealed
 * tube with air in it: a glazed arch over a walking deck, with the power and
 * water runs in the service duct beneath the floor where a real installation
 * would put them.
 *
 * Every tile is built from *stubs* - a half-length tube from the tile centre to
 * each neighbour it connects to - rather than one tube per axis. That single
 * change is what makes corners, T-junctions and crossroads all work: they are
 * just tiles with two non-collinear, three, or four stubs, and each gets a
 * collar at the centre where the stubs meet.
 *
 * The wiring is hidden until asked for. A colony with every conduit glowing is
 * a Christmas tree, and the one moment anybody wants to see cabling is when
 * they are working out why a sector is dark. The overlay lights the live ducts
 * and fades the glass so you can see through to them.
 */

const DUCT_OFFSET = 0.44;
const DUCT_RADIUS = 0.062;

export function RoadLayer({ terrain }: { terrain: TerrainData }) {
  const version = useRoadStore((state) => state.version);
  const showUtilities = useRoadStore((state) => state.showUtilities);

  const glassRef = useRef<THREE.MeshStandardMaterial>(null);
  const powerRef = useRef<THREE.MeshStandardMaterial>(null);
  const waterRef = useRef<THREE.MeshStandardMaterial>(null);
  const stripRef = useRef<THREE.MeshStandardMaterial>(null);

  const geometry = useMemo(() => {
    const decks: THREE.BufferGeometry[] = [];
    const glass: THREE.BufferGeometry[] = [];
    const frames: THREE.BufferGeometry[] = [];
    const strips: THREE.BufferGeometry[] = [];
    const poweredDucts: THREE.BufferGeometry[] = [];
    const deadPower: THREE.BufferGeometry[] = [];
    const wateredDucts: THREE.BufferGeometry[] = [];
    const deadWater: THREE.BufferGeometry[] = [];

    forEachRoadTile(roadGrid, (tx, tz) => {
      const [cx, cz] = tileWorld(tx, tz);
      const cy = terrain.generator.heightAt(cx, cz) + DECK_LIFT;

      let connections = connectionsOf(tx, tz);
      // A lone tile still gets a run, or a single piece would be a bare slab.
      if (connections.length === 0) connections = ['px', 'nx'] as Direction[];

      const { power, water } = tileUtilities(tx, tz);

      // --- Deck, on shared corner heights so neighbours never step ---------
      decks.push(deckQuad(terrain, tx, tz));

      for (const dir of connections) {
        // --- Pressurised shell --------------------------------------------
        glass.push(archStub(terrain, tx, tz, dir, ARCH_RADIUS, 0));

        // Structural frame just outside the glass, so a run reads as a series
        // of ribs rather than an extruded pipe.
        frames.push(archStub(terrain, tx, tz, dir, ARCH_RADIUS + 0.045, 0));

        // --- Floor strip lighting ------------------------------------------
        // The detail that makes a tube read as somewhere people walk at night.
        strips.push(ductStub(terrain, tx, tz, dir, 0, 0.028));

        // --- Service ducts --------------------------------------------------
        const powerDuct = ductStub(terrain, tx, tz, dir, -DUCT_OFFSET, DUCT_RADIUS);
        (power ? poweredDucts : deadPower).push(powerDuct);

        const waterDuct = ductStub(terrain, tx, tz, dir, DUCT_OFFSET, DUCT_RADIUS);
        (water ? wateredDucts : deadWater).push(waterDuct);
      }

      /*
       * A collar where the stubs meet.
       *
       * On a straight run the stubs are collinear and a collar would just be a
       * bulge, so it is skipped. Anywhere the run turns or divides, the collar
       * is what makes the junction read as a deliberate node rather than two
       * tubes that happen to intersect.
       */
      if (!isStraightThrough(connections)) {
        const collar = new THREE.SphereGeometry(
          ARCH_RADIUS + 0.05,
          14,
          8,
          0,
          Math.PI * 2,
          0,
          Math.PI / 2,
        );
        collar.translate(cx, cy, cz);
        frames.push(collar);

        // A junction is also where an airlock would be, so it gets a ring.
        const ring = new THREE.TorusGeometry(ARCH_RADIUS + 0.06, 0.05, 6, 18, Math.PI);
        ring.rotateX(-Math.PI / 2);
        ring.rotateZ(Math.PI);
        ring.translate(cx, cy + 0.02, cz);
        frames.push(ring);
      }
    });

    const merge = (list: THREE.BufferGeometry[]) => {
      if (list.length === 0) return null;
      const merged = list.length === 1 ? list[0] : mergeGeometries(list, false);
      if (merged && list.length > 1) for (const g of list) g.dispose();
      return merged;
    };

    return {
      deck: merge(decks),
      glass: merge(glass),
      frames: merge(frames),
      strips: merge(strips),
      powered: merge(poweredDucts),
      deadPower: merge(deadPower),
      watered: merge(wateredDucts),
      deadWater: merge(deadWater),
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
   * Inspection mode does two things at once, and both are necessary: the glass
   * loses most of its opacity so the ducts underneath become visible, and the
   * live ducts light up. Either alone is half an answer.
   */
  useFrame(({ clock }) => {
    const pulse = 0.7 + Math.sin(clock.elapsedTime * 1.8) * 0.3;

    if (glassRef.current) {
      const target = showUtilities ? 0.1 : 0.3;
      glassRef.current.opacity += (target - glassRef.current.opacity) * 0.12;
    }
    if (powerRef.current) powerRef.current.emissiveIntensity = showUtilities ? pulse * 2.4 : 0.3;
    if (waterRef.current) waterRef.current.emissiveIntensity = showUtilities ? pulse * 2.0 : 0.25;
    // Floor strips stay lit but dim at night, like real emergency lighting.
    if (stripRef.current) stripRef.current.emissiveIntensity = 0.9 + pulse * 0.2;
  });

  if (!geometry.deck) return null;

  return (
    <group name="walkways">
      <mesh geometry={geometry.deck} receiveShadow>
        <meshStandardMaterial
          color="#6d5e50"
          roughness={0.92}
          metalness={0.02}
          side={THREE.DoubleSide}
        />
      </mesh>

      {geometry.strips ? (
        <mesh geometry={geometry.strips}>
          <meshStandardMaterial
            ref={stripRef}
            color="#ffd9a8"
            emissive="#ffc078"
            emissiveIntensity={1}
            roughness={0.3}
          />
        </mesh>
      ) : null}

      {geometry.frames ? (
        <mesh geometry={geometry.frames} castShadow>
          <meshStandardMaterial
            color="#b9c3cc"
            roughness={0.42}
            metalness={0.72}
            side={THREE.DoubleSide}
          />
        </mesh>
      ) : null}

      {geometry.glass ? (
        <mesh geometry={geometry.glass}>
          <meshStandardMaterial
            ref={glassRef}
            color="#9fd4e0"
            transparent
            opacity={0.3}
            roughness={0.08}
            metalness={0.1}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ) : null}

      {geometry.powered ? (
        <mesh geometry={geometry.powered}>
          <meshStandardMaterial
            ref={powerRef}
            color="#f0c657"
            emissive="#f0c657"
            emissiveIntensity={0.3}
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
            emissiveIntensity={0.25}
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
