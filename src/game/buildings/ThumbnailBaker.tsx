'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { BUILDING_IDS, getBuildingModel, type BuildingId } from './catalog';
import { MaterialLibrary, type MaterialKey } from './materials';
import { useThumbnailStore } from '../state/useThumbnailStore';

/**
 * Renders one preview image per structure, once.
 *
 * The build deck used flat SVG glyphs because an earlier attempt at real
 * previews created a **second WebGL context** for an offscreen renderer.
 * Browsers cap the number of live contexts, the game canvas lost that contest,
 * and the whole scene failed to compile shaders. That is recorded in the
 * handoff as a thing not to do again.
 *
 * This does not do it again. It borrows the renderer the game is already using,
 * draws each building into an offscreen render target with it, and reads the
 * pixels back into a data URL. One context, one extra target, and after the bake
 * finishes this component does nothing at all for the rest of the session.
 *
 * The bake is spread across frames - a couple of buildings per frame - because
 * doing twenty in one go is a visible hitch on the first second of play, which
 * is the worst possible moment for one.
 */

const SIZE = 256;
/** How many buildings to draw per frame. Low enough not to drop a frame. */
const PER_FRAME = 2;

export function ThumbnailBaker() {
  const gl = useThree((state) => state.gl);
  const setThumbnail = useThumbnailStore((state) => state.set);
  const markComplete = useThumbnailStore((state) => state.markComplete);

  const queue = useRef<BuildingId[]>([...BUILDING_IDS]);
  const started = useRef(false);

  const materials = useMemo(() => new MaterialLibrary(), []);

  const kit = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(SIZE, SIZE, {
      colorSpace: THREE.SRGBColorSpace,
      samples: 4,
    });

    const scene = new THREE.Scene();
    // Deliberately transparent: the card supplies its own background, so a
    // baked-in one would show as a square patch against the glass panel.
    scene.background = null;

    // Roughly the game's own key/fill so a preview looks like the thing you
    // will actually see on the ground.
    scene.add(new THREE.HemisphereLight('#c08a5a', '#241c17', 1.15));
    const key = new THREE.DirectionalLight('#ffd9b0', 2.5);
    key.position.set(4, 6, 5);
    scene.add(key);
    const fill = new THREE.DirectionalLight('#8fb4c4', 0.55);
    fill.position.set(-5, 3, -4);
    scene.add(fill);

    // Three-quarter view from slightly above: the angle that reads a footprint
    // and a silhouette at the same time.
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200);

    return { target, scene, camera };
  }, []);

  useEffect(() => {
    return () => {
      kit.target.dispose();
      materials.dispose();
    };
  }, [kit, materials]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const pixels = new Uint8Array(SIZE * SIZE * 4);
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');

    let frame = 0;

    const bakeOne = (id: BuildingId) => {
      const model = getBuildingModel(id);
      const group = new THREE.Group();

      for (const [key, geometry] of Object.entries(model) as [
        MaterialKey,
        THREE.BufferGeometry,
      ][]) {
        if (!geometry) continue;
        group.add(new THREE.Mesh(geometry, materials.get(key)));
      }

      // Frame the model rather than moving the camera per building: scale to a
      // fixed box so every card in the deck reads at the same visual weight,
      // which a shared camera distance would not give when a spaceport is ten
      // times the height of a storage tank.
      const box = new THREE.Box3().setFromObject(group);
      const size = box.getSize(new THREE.Vector3());
      const centre = box.getCenter(new THREE.Vector3());
      const largest = Math.max(size.x, size.y, size.z, 0.001);

      group.position.sub(centre);
      group.scale.setScalar(2.4 / largest);

      kit.scene.add(group);
      kit.camera.position.set(3.1, 2.5, 3.4);
      kit.camera.lookAt(0, 0, 0);

      /*
       * Borrow the renderer, then put it back exactly as it was.
       *
       * The clear colour matters as much as the render target: the game clears
       * to opaque black, which bakes a solid square behind every preview and
       * hides the card's own gradient. Clearing to alpha 0 gives a cut-out.
       * Every piece of renderer state touched here is saved and restored -
       * leaving the clear alpha at 0 would make the whole game canvas
       * transparent on the very next frame.
       */
      const previousTarget = gl.getRenderTarget();
      const previousClearColor = new THREE.Color();
      gl.getClearColor(previousClearColor);
      const previousClearAlpha = gl.getClearAlpha();

      gl.setRenderTarget(kit.target);
      gl.setClearColor(0x000000, 0);
      gl.clear(true, true, true);
      gl.render(kit.scene, kit.camera);
      gl.readRenderTargetPixels(kit.target, 0, 0, SIZE, SIZE, pixels);

      gl.setRenderTarget(previousTarget);
      gl.setClearColor(previousClearColor, previousClearAlpha);

      kit.scene.remove(group);
      for (const child of group.children) {
        if (child instanceof THREE.Mesh) child.geometry = undefined as never;
      }

      if (!ctx) return;
      const image = ctx.createImageData(SIZE, SIZE);
      // WebGL reads bottom-up; the canvas expects top-down.
      for (let y = 0; y < SIZE; y++) {
        const from = (SIZE - 1 - y) * SIZE * 4;
        image.data.set(pixels.subarray(from, from + SIZE * 4), y * SIZE * 4);
      }
      ctx.putImageData(image, 0, 0);
      setThumbnail(id, canvas.toDataURL('image/png'));
    };

    const step = () => {
      for (let i = 0; i < PER_FRAME && queue.current.length > 0; i++) {
        const id = queue.current.shift();
        if (id) bakeOne(id);
      }
      if (queue.current.length > 0) {
        frame = requestAnimationFrame(step);
      } else {
        markComplete();
      }
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [gl, kit, materials, setThumbnail, markComplete]);

  return null;
}
