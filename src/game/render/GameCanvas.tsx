'use client';

import { Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';

import { invalidateModelCache } from '../buildings/catalog';
import { preloadImportedModels } from '../buildings/importedModels';
import { useQuality, useSettingsStore } from '../state/useSettingsStore';
import { Scene } from './Scene';

/**
 * The WebGL surface and its renderer configuration.
 *
 * Two settings here are load-bearing and easy to get wrong:
 *
 *  - `antialias: false` plus `NoToneMapping`. Both jobs belong to the
 *    post-processing chain; leaving them on in the renderer would either be
 *    wasted work or would tone-map twice and wash the image out.
 *  - `dpr` capped by the quality tier. On a 4K display an uncapped device pixel
 *    ratio quadruples the fragment cost for no visible gain.
 */
export function GameCanvas() {
  const quality = useQuality();
  const detect = useSettingsStore((state) => state.detect);
  const hydrate = useSettingsStore((state) => state.hydrate);

  // Both touch browser-only APIs - WebGL for detection, localStorage for stored
  // preferences - so both have to wait for mount. Stored preferences are read
  // second so an explicit choice always wins over what the hardware suggests.
  useEffect(() => {
    detect();
    hydrate();
  }, [detect, hydrate]);

  /*
   * Downloaded models are fetched here, at canvas mount, which is behind the
   * intro video. Three megabytes lands long before the player can place
   * anything.
   *
   * The cache has to be dropped afterwards: any structure whose geometry was
   * requested while the download was still in flight cached its procedural
   * version, and would otherwise keep it for the rest of the session.
   */
  useEffect(() => {
    let cancelled = false;
    preloadImportedModels().then(() => {
      if (!cancelled) invalidateModelCache();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Canvas
      // three deprecated PCFSoftShadowMap in r185, and R3F's `shadows` boolean
      // still selects it; "percentage" asks for plain PCF, which is what the
      // soft variant now falls back to anyway.
      shadows={quality.shadows ? 'percentage' : false}
      dpr={[1, quality.maxDpr]}
      camera={{ fov: 48, near: 0.5, far: 4000, position: [46, 38, 58] }}
      gl={{
        antialias: false,
        alpha: false,
        stencil: false,
        powerPreference: 'high-performance',
      }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NoToneMapping;

        // Report what context we actually got. A shader that overflows the
        // fragment sampler budget almost always means we were handed a
        // degraded or WebGL1 context rather than that the material is complex,
        // so the capability numbers are the first thing worth knowing.
        const context = gl.getContext();
        console.info('[kryonis] renderer', {
          webgl2: gl.capabilities.isWebGL2,
          maxTextures: gl.capabilities.maxTextures,
          maxVertexTextures: gl.capabilities.maxVertexTextures,
          maxSamples: gl.capabilities.maxSamples,
          precision: gl.capabilities.precision,
          renderer: context
            ? context.getParameter(context.RENDERER)
            : 'no context',
        });
      }}
      // The canvas is the game; let the HUD above it own pointer events.
      style={{ position: 'absolute', inset: 0, touchAction: 'none' }}
    >
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
    </Canvas>
  );
}
