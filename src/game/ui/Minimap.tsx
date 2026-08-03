'use client';

import { useEffect, useMemo, useRef } from 'react';

import { REGION_TILES, TILE_SIZE, VALLEY_FLOOR_RADIUS, WORLD_HALF } from '../core/constants';
import { rotatedFootprint } from '../buildings/catalog';
import { useColonyStore } from '../state/useColonyStore';
import { useWorldStore } from '../state/useWorldStore';
import { TerrainKind } from '../world/terrain';

const SIZE = 132;

/**
 * The crater minimap.
 *
 * Terrain is painted once into an offscreen canvas when the region loads - it
 * never changes - and only the structures and the claim ring are redrawn as the
 * colony grows. Repainting 9216 tiles every frame to move a dozen dots would be
 * absurd.
 *
 * Kept deliberately small and low-contrast. A minimap is a glance, not a
 * second view of the game.
 */
export function Minimap() {
  const terrain = useWorldStore((state) => state.terrain);
  const buildings = useColonyStore((state) => state.buildings);
  const unlockedRadius = useColonyStore((state) => state.unlockedRadius);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Static terrain layer.
  const base = useMemo(() => {
    if (typeof document === 'undefined') return null;

    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const image = ctx.createImageData(SIZE, SIZE);
    const data = image.data;
    const scale = REGION_TILES / SIZE;

    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const tx = Math.min(REGION_TILES - 1, Math.floor(x * scale));
        const tz = Math.min(REGION_TILES - 1, Math.floor(y * scale));
        const index = tz * REGION_TILES + tx;

        const kind = terrain.kind[index] as TerrainKind;
        const height = terrain.height[index];

        // Base tint per surface, then shaded by elevation so the crater wall
        // reads as a raised ring rather than a flat band of colour.
        let r = 92;
        let g = 58;
        let b = 40;
        if (kind === TerrainKind.Ice) {
          r = 150;
          g = 172;
          b = 178;
        } else if (kind === TerrainKind.Lava) {
          r = 48;
          g = 34;
          b = 30;
        } else if (kind === TerrainKind.Cliff) {
          r = 66;
          g = 46;
          b = 36;
        } else if (kind === TerrainKind.Dust) {
          r = 122;
          g = 82;
          b = 52;
        }

        const shade = 0.62 + Math.min(1, Math.max(0, (height + 6) / 56)) * 0.7;
        const offset = (y * SIZE + x) * 4;
        data[offset] = Math.min(255, r * shade);
        data[offset + 1] = Math.min(255, g * shade);
        data[offset + 2] = Math.min(255, b * shade);
        data[offset + 3] = 255;
      }
    }

    ctx.putImageData(image, 0, 0);
    return canvas;
  }, [terrain]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !base) return;

    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.drawImage(base, 0, 0);

    const toPixel = (world: number) => ((world + WORLD_HALF) / (WORLD_HALF * 2)) * SIZE;

    // Claimed perimeter.
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, (unlockedRadius / (WORLD_HALF * 2)) * SIZE * 2, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(201, 138, 82, 0.75)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // The crater floor edge, as a faint reference.
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, (VALLEY_FLOOR_RADIUS / (WORLD_HALF * 2)) * SIZE * 2, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.stroke();

    // Structures.
    for (const building of buildings) {
      const [w, d] = rotatedFootprint(building.type, building.rotation);
      const x = toPixel((building.tx + w / 2) * TILE_SIZE - WORLD_HALF);
      const y = toPixel((building.tz + d / 2) * TILE_SIZE - WORLD_HALF);

      ctx.fillStyle =
        building.progress < 1 ? 'rgba(201, 160, 90, 0.95)' : 'rgba(236, 230, 221, 0.92)';
      const size = building.type === 'lander' ? 3.5 : 2.2;
      ctx.fillRect(x - size / 2, y - size / 2, size, size);
    }
  }, [base, buildings, unlockedRadius]);

  return (
    <div className="glass anim-fade pointer-events-auto overflow-hidden rounded-[3px] p-1.5">
      <canvas
        ref={canvasRef}
        width={SIZE}
        height={SIZE}
        className="block h-24 w-24 rounded-[2px] min-[1180px]:h-[132px] min-[1180px]:w-[132px]"
        style={{ imageRendering: 'pixelated' }}
        aria-label="Crater map"
      />
    </div>
  );
}
