'use client';

import { useEffect, useMemo, useRef } from 'react';

import {
  REGION_TILES,
  TILE_SIZE,
  UNLOCK_STEP,
  VALLEY_FLOOR_RADIUS,
  WORLD_HALF,
} from '../core/constants';
import { rotatedFootprint } from '../buildings/catalog';
import { formatAmount } from '../core/resources';
import { useColonyStore } from '../state/useColonyStore';
import { useWorldStore } from '../state/useWorldStore';
import { announce } from '../state/useToastStore';
import { DEPOSIT_LABELS, DepositKind, TerrainKind, type TerrainData } from '../world/terrain';
import { Console, ConsoleSection, Readout } from './Console';

const MAP_PIXELS = 520;

/**
 * The territory screen.
 *
 * This is the screen that did not exist: the dock had a Territory button that
 * switched a section nothing rendered for, so it silently did nothing at all.
 *
 * What it needs to answer is one question - "is the next ring worth what it
 * costs?" - and the honest answer requires knowing what is *in* the ring. So
 * the survey below counts real tiles out of the real terrain rather than
 * quoting a flat price and leaving the player to guess.
 */
export function TerritoryConsole({ onClose }: { onClose: () => void }) {
  const terrain = useWorldStore((state) => state.terrain);
  const buildings = useColonyStore((state) => state.buildings);
  const unlockedRadius = useColonyStore((state) => state.unlockedRadius);
  const money = useColonyStore((state) => state.stock.money);
  const expandTerritory = useColonyStore((state) => state.expandTerritory);
  const nextExpansionCost = useColonyStore((state) => state.nextExpansionCost);

  const atMaximum = unlockedRadius >= VALLEY_FLOOR_RADIUS;
  const nextRadius = Math.min(VALLEY_FLOOR_RADIUS, unlockedRadius + UNLOCK_STEP);
  const cost = nextExpansionCost();
  const affordable = money >= cost;
  const claimed = Math.min(1, unlockedRadius / VALLEY_FLOOR_RADIUS);

  // What is already claimed, and what the next ring would add.
  const inside = useMemo(() => surveyRing(terrain, 0, unlockedRadius), [terrain, unlockedRadius]);
  const nextRing = useMemo(
    () => (atMaximum ? null : surveyRing(terrain, unlockedRadius, nextRadius)),
    [terrain, unlockedRadius, nextRadius, atMaximum],
  );

  const claim = () => {
    if (!expandTerritory()) return;
    announce('Perimeter extended', `Claim now reaches ${Math.round(nextRadius)} m`, 'good');
  };

  return (
    <Console
      title="TERRITORY"
      legend={`${Math.round(claimed * 100)}% of the crater floor claimed`}
      onClose={onClose}
    >
      <div className="grid gap-6 min-[1180px]:grid-cols-[minmax(0,1fr)_24rem] min-[1180px]:gap-9">
        {/* --- The map ---------------------------------------------------- */}
        <div className="min-w-0">
          <ConsoleSection
            title="Crater survey"
            hint="Bronze ring is your perimeter · dashed ring is the next claim"
          >
            <div className="flex justify-center rounded-[3px] border border-white/[0.07] bg-black/40 p-4">
              <ClaimMap
                terrain={terrain}
                buildings={buildings}
                unlockedRadius={unlockedRadius}
                nextRadius={atMaximum ? null : nextRadius}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2.5">
              <Legend swatch="#c98a52" label="Your perimeter" />
              <Legend swatch="#ece6dd" label="Structures" />
              <Legend swatch="#96acb2" label="Ice field" />
              <Legend swatch="#7a5234" label="Buildable regolith" />
              <Legend swatch="#422e24" label="Cliff — never buildable" />
            </div>
          </ConsoleSection>
        </div>

        {/* --- The decision ----------------------------------------------- */}
        <div className="min-w-0">
          <div className="grid grid-cols-2 gap-3">
            <Readout label="Claimed" value={`${Math.round(claimed * 100)}%`} tone="accent" />
            <Readout label="Perimeter" value={`${Math.round(unlockedRadius)} m`} />
            <Readout label="Buildable tiles" value={formatAmount(inside.buildable)} />
            <Readout label="Credits" value={formatAmount(money)} />
          </div>

          <ConsoleSection className="mt-7" title="Next claim">
            {atMaximum ? (
              <div className="state-owned rounded-[3px] px-4 py-4">
                <span className="tag text-dust">Complete</span>
                <p className="t-sm mt-2.5 leading-snug text-ash">
                  The whole crater floor is yours. Beyond the perimeter the ground climbs into the
                  escarpment — there is nothing out there to build on.
                </p>
              </div>
            ) : (
              <div className={`rounded-[3px] px-4 py-4 ${affordable ? 'state-open' : 'state-blocked'}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="t-md text-bone">
                    Extend to {Math.round(nextRadius)} m
                  </span>
                  <span className={`t-num text-[0.9rem] ${affordable ? 'text-dust' : 'text-warn'}`}>
                    {formatAmount(cost)}
                  </span>
                </div>

                <p className="t-sm mt-2 leading-snug text-ash">
                  A {UNLOCK_STEP} m band around the current perimeter. This is what the survey
                  finds in it:
                </p>

                {nextRing ? (
                  <dl className="mt-3.5 space-y-2">
                    <SurveyRow
                      label="Buildable ground"
                      value={`${nextRing.buildable} tiles`}
                      fraction={nextRing.total > 0 ? nextRing.buildable / nextRing.total : 0}
                    />
                    <SurveyRow
                      label="Ice"
                      value={nextRing.ice > 0 ? `${nextRing.ice} tiles` : 'None'}
                      fraction={nextRing.total > 0 ? nextRing.ice / nextRing.total : 0}
                    />
                    <SurveyRow
                      label="Ore deposits"
                      value={nextRing.deposits > 0 ? `${nextRing.deposits} tiles` : 'None'}
                      fraction={nextRing.total > 0 ? nextRing.deposits / nextRing.total : 0}
                    />
                  </dl>
                ) : null}

                {nextRing && nextRing.bestDeposit !== DepositKind.None ? (
                  <p className="t-sm mt-3 text-dust">
                    Richest find: {DEPOSIT_LABELS[nextRing.bestDeposit]}
                  </p>
                ) : null}

                <button
                  type="button"
                  disabled={!affordable}
                  onClick={claim}
                  className="press mt-4 w-full rounded-[3px] bg-dust py-3 text-void transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-faint"
                >
                  <span className="t-md">Claim this band</span>
                </button>

                {!affordable ? (
                  <p className="t-sm mt-2.5 text-warn">
                    Short {formatAmount(cost - money)} credits.
                  </p>
                ) : null}
              </div>
            )}
          </ConsoleSection>

          <ConsoleSection className="mt-7" title="Why the crater ends">
            <p className="t-sm leading-relaxed text-ash">
              The colony sits on the floor of an impact basin. At {VALLEY_FLOOR_RADIUS} m the
              ground begins to climb into a {'≈'}44 m escarpment, and neither a rover nor a
              foundation crew can work on it. The perimeter is not a rule — it is the wall.
            </p>
          </ConsoleSection>
        </div>
      </div>
    </Console>
  );
}

/**
 * The claim map.
 *
 * Painted at 2x the displayed size and scaled down, because the terrain layer is
 * nearest-neighbour sampled from a 96x96 grid and looks like a QR code at 1:1.
 */
function ClaimMap({
  terrain,
  buildings,
  unlockedRadius,
  nextRadius,
}: {
  terrain: TerrainData;
  buildings: { type: string; tx: number; tz: number; rotation: number; progress: number }[];
  unlockedRadius: number;
  nextRadius: number | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // The terrain layer never changes for a given region, so it is painted once
  // into an offscreen canvas and reused as the colony grows.
  const base = useMemo(() => {
    if (typeof document === 'undefined') return null;

    const canvas = document.createElement('canvas');
    canvas.width = REGION_TILES;
    canvas.height = REGION_TILES;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const image = ctx.createImageData(REGION_TILES, REGION_TILES);
    const data = image.data;

    for (let index = 0; index < REGION_TILES * REGION_TILES; index++) {
      const kind = terrain.kind[index] as TerrainKind;
      const height = terrain.height[index];

      let [r, g, b] = TERRAIN_COLOUR[kind] ?? TERRAIN_COLOUR[TerrainKind.Plain];

      // Deposits are tinted rather than dotted: a dot at this scale is one
      // pixel, which is indistinguishable from noise.
      if (terrain.deposit[index] !== DepositKind.None) {
        const richness = terrain.depositRichness[index];
        r += 42 * richness;
        g += 26 * richness;
      }

      const shade = 0.6 + Math.min(1, Math.max(0, (height + 6) / 56)) * 0.75;
      const offset = index * 4;
      data[offset] = Math.min(255, r * shade);
      data[offset + 1] = Math.min(255, g * shade);
      data[offset + 2] = Math.min(255, b * shade);
      data[offset + 3] = 255;
    }

    ctx.putImageData(image, 0, 0);
    return canvas;
  }, [terrain]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !base) return;

    const size = MAP_PIXELS;
    ctx.clearRect(0, 0, size, size);

    // Smoothing on for the terrain upscale, off for nothing else - the rings
    // and markers are drawn as vectors on top.
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(base, 0, 0, size, size);

    const centre = size / 2;
    const worldToPixels = size / (WORLD_HALF * 2);
    const toPixel = (world: number) => (world + WORLD_HALF) * worldToPixels;

    // Everything outside the claim is dimmed, so "yours" reads instantly.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, size, size);
    ctx.arc(centre, centre, unlockedRadius * worldToPixels, 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(12, 10, 9, 0.62)';
    ctx.fill();
    ctx.restore();

    // The next band, dashed.
    if (nextRadius !== null) {
      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.arc(centre, centre, nextRadius * worldToPixels, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(201, 138, 82, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    // The claimed perimeter.
    ctx.beginPath();
    ctx.arc(centre, centre, unlockedRadius * worldToPixels, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(201, 138, 82, 0.95)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // The crater floor edge - the hard limit.
    ctx.beginPath();
    ctx.arc(centre, centre, VALLEY_FLOOR_RADIUS * worldToPixels, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Structures.
    for (const building of buildings) {
      const [w, d] = rotatedFootprint(building.type as never, building.rotation);
      const x = toPixel((building.tx + w / 2) * TILE_SIZE - WORLD_HALF);
      const y = toPixel((building.tz + d / 2) * TILE_SIZE - WORLD_HALF);
      const extent = Math.max(w, d) * TILE_SIZE * worldToPixels;

      ctx.fillStyle =
        building.progress < 1 ? 'rgba(201, 160, 90, 0.95)' : 'rgba(236, 230, 221, 0.95)';
      ctx.fillRect(x - extent / 2, y - extent / 2, Math.max(3, extent), Math.max(3, extent));
    }
  }, [base, buildings, unlockedRadius, nextRadius]);

  return (
    <canvas
      ref={canvasRef}
      width={MAP_PIXELS}
      height={MAP_PIXELS}
      className="block h-auto w-full max-w-[32.5rem] rounded-[2px]"
      aria-label="Crater claim map"
    />
  );
}

const TERRAIN_COLOUR: Record<TerrainKind, [number, number, number]> = {
  [TerrainKind.Plain]: [122, 82, 52],
  [TerrainKind.Dust]: [146, 104, 66],
  [TerrainKind.Rock]: [98, 68, 48],
  [TerrainKind.Cliff]: [66, 46, 36],
  [TerrainKind.Ice]: [150, 172, 178],
  [TerrainKind.Lava]: [52, 38, 33],
};

interface RingSurvey {
  total: number;
  buildable: number;
  ice: number;
  deposits: number;
  bestDeposit: DepositKind;
}

/**
 * Counts what lies in an annulus of the crater.
 *
 * Measured from the generated terrain rather than authored, so the figures the
 * player buys against are the figures they actually get. Tiles are tested at
 * their centres, which is the same test placement uses.
 */
function surveyRing(terrain: TerrainData, innerRadius: number, outerRadius: number): RingSurvey {
  const survey: RingSurvey = {
    total: 0,
    buildable: 0,
    ice: 0,
    deposits: 0,
    bestDeposit: DepositKind.None,
  };

  let bestRichness = 0;

  for (let tz = 0; tz < REGION_TILES; tz++) {
    for (let tx = 0; tx < REGION_TILES; tx++) {
      const x = (tx + 0.5) * TILE_SIZE - WORLD_HALF;
      const z = (tz + 0.5) * TILE_SIZE - WORLD_HALF;
      const radius = Math.hypot(x, z);
      if (radius < innerRadius || radius >= outerRadius) continue;

      const index = tz * REGION_TILES + tx;
      survey.total++;
      if (terrain.buildable[index]) survey.buildable++;
      if (terrain.kind[index] === TerrainKind.Ice) survey.ice++;

      const deposit = terrain.deposit[index] as DepositKind;
      if (deposit !== DepositKind.None) {
        survey.deposits++;
        const richness = terrain.depositRichness[index];
        if (richness > bestRichness) {
          bestRichness = richness;
          survey.bestDeposit = deposit;
        }
      }
    }
  }

  return survey;
}

function SurveyRow({
  label,
  value,
  fraction,
}: {
  label: string;
  value: string;
  fraction: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <dt className="t-sm w-32 shrink-0 text-ash">{label}</dt>
      <dd className="flex flex-1 items-center gap-2.5">
        <span className="h-1 flex-1 rounded-full bg-white/10">
          <span
            className="block h-1 rounded-full bg-dust"
            style={{ width: `${Math.max(0, Math.min(1, fraction)) * 100}%` }}
          />
        </span>
        <span className="t-num w-20 shrink-0 text-right text-[0.7rem] text-bone">{value}</span>
      </dd>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-[1px]"
        style={{ backgroundColor: swatch }}
        aria-hidden
      />
      <span className="t-sm text-ash">{label}</span>
    </span>
  );
}
