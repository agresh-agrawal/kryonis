'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { BUILDINGS, type BuildingId } from '../buildings/catalog';
import {
  IMPORTED_MODELS,
  getImportedModel,
  preloadImportedModels,
} from '../buildings/importedModels';
import { MaterialLibrary, type MaterialKey } from '../buildings/materials';
import type { BuildingModel } from '../buildings/model';

/**
 * Every imported model, rotating, labelled with what it is currently used for.
 *
 * Each tile gets its own small Canvas rather than one shared scene. That is
 * normally the wrong call - contexts are a scarce resource - but here it buys
 * per-tile framing with no camera maths, and this page is never open at the
 * same time as the game.
 */
export function ModelGallery() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    preloadImportedModels().then(() => setReady(true));
  }, []);

  const entries = Object.entries(IMPORTED_MODELS) as [BuildingId, string][];

  return (
    <main className="min-h-dvh bg-void px-6 py-8 min-[1180px]:px-10">
      <header className="mx-auto max-w-[100rem]">
        <h1 className="text-[1.8rem] leading-none font-light tracking-[0.4em] text-bone">
          IMPORTED MODELS
        </h1>
        <p className="t-sm mt-3 max-w-3xl leading-relaxed text-ash">
          Every downloaded model currently wired into the game, at real scale, labelled with the
          structure it stands in for. If a model is assigned to the wrong building, say which
          number should be which — swapping them is a one-line change in{' '}
          <code className="rounded-[2px] bg-white/10 px-1.5 py-0.5 text-dust">IMPORTED_MODELS</code>.
        </p>
        <p className="t-micro mt-4">
          {ready ? `${entries.length} models loaded` : 'Loading models…'}
        </p>
        <span className="rule-x mt-5 block" />
      </header>

      <div className="mx-auto mt-8 grid max-w-[100rem] gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {entries.map(([id, file], index) => (
          <ModelCard key={id} index={index + 1} buildingId={id} file={file} ready={ready} />
        ))}
      </div>
    </main>
  );
}

function ModelCard({
  index,
  buildingId,
  file,
  ready,
}: {
  index: number;
  buildingId: BuildingId;
  file: string;
  ready: boolean;
}) {
  const definition = BUILDINGS[buildingId];
  const model = ready ? getImportedModel(buildingId) : undefined;

  // Real world size, so a tile that looks wrong next to its neighbours is
  // obviously wrong rather than subtly wrong.
  const size = useMemo(() => {
    if (!model) return null;
    const box = new THREE.Box3();
    for (const geometry of Object.values(model)) {
      if (geometry?.boundingBox) box.union(geometry.boundingBox);
    }
    if (box.isEmpty()) return null;
    return box.getSize(new THREE.Vector3());
  }, [model]);

  return (
    <figure className="glass overflow-hidden rounded-[3px]">
      <div className="relative h-56 bg-[radial-gradient(circle_at_50%_40%,#241c17,#0c0a09)]">
        <span className="t-num absolute left-3 top-3 z-10 rounded-[2px] bg-black/50 px-2 py-1 text-[0.7rem] text-dust">
          {index}
        </span>

        {model ? (
          <Canvas
            camera={{ fov: 40, position: [7, 5, 7] }}
            gl={{ antialias: true, alpha: true }}
            dpr={[1, 1.75]}
          >
            <Suspense fallback={null}>
              <Turntable model={model} />
            </Suspense>
          </Canvas>
        ) : (
          <div className="grid h-full place-items-center">
            <span className="t-micro">{ready ? 'Failed to load' : 'Loading…'}</span>
          </div>
        )}
      </div>

      <figcaption className="p-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="t-md text-bone">{definition.name}</span>
          <span className="t-num shrink-0 text-[0.66rem] text-faint">
            {definition.footprint[0]}×{definition.footprint[1]}
          </span>
        </div>
        <p className="t-sm mt-1.5 truncate text-dust">{file}</p>
        <p className="t-sm mt-1 text-faint">
          {size
            ? `${size.x.toFixed(1)} × ${size.y.toFixed(1)} × ${size.z.toFixed(1)} m`
            : 'no geometry'}
          {model ? ` · ${Object.keys(model).join(', ')}` : ''}
        </p>
      </figcaption>
    </figure>
  );
}

/** One model on a slow turntable, lit like the game lights it. */
function Turntable({ model }: { model: BuildingModel }) {
  const materials = useMemo(() => new MaterialLibrary(), []);
  useEffect(() => () => materials.dispose(), [materials]);

  const group = useMemo(() => {
    const root = new THREE.Group();
    for (const [key, geometry] of Object.entries(model) as [MaterialKey, THREE.BufferGeometry][]) {
      if (!geometry) continue;
      root.add(new THREE.Mesh(geometry, materials.get(key)));
    }

    // Sit the model on the turntable and frame it: the camera is fixed, so the
    // model is scaled to fit rather than the camera being moved.
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const largest = Math.max(size.x, size.y, size.z, 0.001);
    root.scale.setScalar(4.2 / largest);
    root.position.y = -(size.y * (4.2 / largest)) / 2;

    return root;
  }, [model, materials]);

  useFrame((_, delta) => {
    group.rotation.y += delta * 0.45;
    materials.update(delta, 0);
  });

  return (
    <>
      {/* Roughly the game's key/fill: low warm sun, cold sky bounce. */}
      <hemisphereLight args={['#c08a5a', '#241c17', 1.1]} />
      <directionalLight position={[5, 7, 4]} intensity={2.4} color="#ffd9b0" />
      <directionalLight position={[-6, 3, -5]} intensity={0.5} color="#8fb4c4" />
      <primitive object={group} />
    </>
  );
}
