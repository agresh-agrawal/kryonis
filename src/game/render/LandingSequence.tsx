'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { buildingTransform, useColonyStore } from '../state/useColonyStore';
import type { TerrainData } from '../world/terrain';

export function LandingSequence({ terrain }: { terrain: TerrainData }) {
  const buildings = useColonyStore((state) => state.buildings);
  const [active, setActive] = useState(false);
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const trailRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);

  const lander = useMemo(() => buildings.find((building) => building.type === 'lander' && building.progress >= 1) ?? null, [buildings]);

  useEffect(() => {
    if (!lander) return;
    const timer = window.setTimeout(() => setActive(true), 650);
    return () => window.clearTimeout(timer);
  }, [lander?.id]);

  useFrame((_, delta) => {
    if (!active || !lander || !groupRef.current || !ringRef.current || !trailRef.current) return;

    timeRef.current += delta;
    const duration = 2.3;
    const t = Math.min(1, timeRef.current / duration);
    const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const transform = buildingTransform(terrain, lander);

    const altitude = 24 - 24 * eased;
    groupRef.current.position.set(transform.x, 8 + altitude, transform.z);
    groupRef.current.rotation.z = Math.sin(t * 6.6) * 0.2;
    groupRef.current.rotation.y = Math.PI * 0.14 + Math.sin(t * 3.2) * 0.1;
    groupRef.current.scale.setScalar(Math.max(0.08, 1 - Math.max(0, (t - 0.9) * 2.5)));

    if (ringRef.current.material && 'opacity' in ringRef.current.material) {
      const material = ringRef.current.material as THREE.Material & { opacity: number };
      material.opacity = t < 0.9 ? Math.min(0.8, 0.18 + t * 0.58) : Math.max(0, 1 - (t - 0.9) * 3.2);
    }

    ringRef.current.scale.setScalar(THREE.MathUtils.lerp(0.16, 3.2, t));
    trailRef.current.scale.setScalar(0.76 + Math.sin(t * 22) * 0.1);
    trailRef.current.position.y = -0.9 - t * 0.24;
  });

  if (!lander || !active) return null;

  const transform = buildingTransform(terrain, lander);

  return (
    <group ref={groupRef} position={[transform.x, 8, transform.z]}>
      <group ref={trailRef}>
        <mesh position={[0, -0.65, 0]} castShadow>
          <coneGeometry args={[0.18, 0.9, 12]} />
          <meshStandardMaterial color="#ffb14a" emissive="#ff6a00" emissiveIntensity={1.6} />
        </mesh>
        <mesh position={[0, -1.15, 0]} castShadow>
          <cylinderGeometry args={[0.06, 0.08, 0.5, 10]} />
          <meshStandardMaterial color="#2f221b" emissive="#a14a1a" emissiveIntensity={0.6} />
        </mesh>
      </group>

      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.22, 0.3, 1.45, 16]} />
        <meshStandardMaterial color="#d7dce7" emissive="#7284a6" emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
        <coneGeometry args={[0.34, 0.8, 18]} />
        <meshStandardMaterial color="#8fd4ff" emissive="#3b77ff" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[0, 1.18, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.28, 0.22, 0.28]} />
        <meshStandardMaterial color="#fff0b8" emissive="#ffd55f" emissiveIntensity={0.9} />
      </mesh>
      <mesh position={[0, -1.0, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.2, 0.24, 10]} />
        <meshStandardMaterial color="#5c3a2b" emissive="#ff6a00" emissiveIntensity={0.4} />
      </mesh>
      <pointLight intensity={4.8} color="#ff8f3d" distance={12} decay={2} />

      <mesh ref={ringRef} position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.25, 0.8, 48]} />
        <meshBasicMaterial color="#ffd98c" transparent opacity={0.2} />
      </mesh>
    </group>
  );
}
