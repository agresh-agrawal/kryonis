import { MAX_BUILDABLE_SLOPE, REGION_TILES } from '@/game/core/constants';
import { hashString } from '@/game/core/rng';
import {
  DEPOSIT_LABELS,
  DepositKind,
  TERRAIN_LABELS,
  TerrainKind,
  generateTerrain,
  surveySite,
  type TerrainConfig,
} from '@/game/world/terrain';
import { computeSun } from '@/game/world/sun';

/**
 * Terrain diagnostics.
 *
 * A plain server-rendered page that runs the world generator and reports what
 * it produced. Terrain balance is the hardest thing to eyeball from inside the
 * game - "is roughly half this map buildable?" is a question about numbers, not
 * about how the regolith looks - so it gets its own readout.
 *
 * Used when tuning the landing-site presets.
 */

export const dynamic = 'force-dynamic';

const SITES: { name: string; config: Partial<TerrainConfig> }[] = [
  {
    name: 'Arcadia Planitia (default)',
    config: {
      seed: hashString('kryonis-arcadia-planitia'),
      ruggedness: 0.5,
      iceAbundance: 0.55,
      mineralAbundance: 0.5,
      dustiness: 0.45,
    },
  },
  {
    name: 'Flat & mineral-poor',
    config: { seed: 12345, ruggedness: 0.15, iceAbundance: 0.3, mineralAbundance: 0.25, dustiness: 0.7 },
  },
  {
    name: 'Ice-rich & cliffy',
    config: { seed: 98765, ruggedness: 0.9, iceAbundance: 0.95, mineralAbundance: 0.5, dustiness: 0.3 },
  },
  {
    name: 'Mineral-rich highlands',
    config: { seed: 55555, ruggedness: 0.7, iceAbundance: 0.25, mineralAbundance: 0.95, dustiness: 0.4 },
  },
];

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export default function DiagnosticsPage() {
  const rows = SITES.map(({ name, config }) => {
    const started = performance.now();
    const terrain = generateTerrain({ ...config, size: REGION_TILES });
    const elapsed = performance.now() - started;
    const survey = surveySite(terrain);

    const kindCounts = new Map<TerrainKind, number>();
    for (let i = 0; i < terrain.kind.length; i++) {
      const kind = terrain.kind[i] as TerrainKind;
      kindCounts.set(kind, (kindCounts.get(kind) ?? 0) + 1);
    }

    return { name, terrain, survey, kindCounts, elapsed };
  });

  // Regenerating from the same seed must produce identical terrain, or saved
  // games would not survive a reload.
  const first = generateTerrain({ ...SITES[0].config, size: REGION_TILES });
  const second = generateTerrain({ ...SITES[0].config, size: REGION_TILES });
  let mismatches = 0;
  for (let i = 0; i < first.height.length; i++) {
    if (first.height[i] !== second.height[i] || first.kind[i] !== second.kind[i]) mismatches++;
  }

  const sunSamples = [0, 0.2, 0.25, 0.35, 0.5, 0.65, 0.75, 0.8].map((t) => ({
    t,
    sun: computeSun(t),
  }));

  const total = REGION_TILES * REGION_TILES;

  return (
    <main className="selectable h-dvh overflow-auto bg-[#14100e] p-8 font-mono text-sm text-ink">
      <h1 className="mb-1 text-xl tracking-[0.3em]">KRYONIS DIAGNOSTICS</h1>
      <p className="mb-6 text-ink-faint">
        Region {REGION_TILES}&times;{REGION_TILES} = {total} tiles &middot; max buildable slope{' '}
        {MAX_BUILDABLE_SLOPE}
      </p>

      <section className="mb-8">
        <h2 className="mb-2 text-tech">Determinism</h2>
        <p className={mismatches === 0 ? 'text-good' : 'text-alert'}>
          {mismatches === 0
            ? `PASS - two generations from one seed matched on all ${total} tiles.`
            : `FAIL - ${mismatches} tiles differed between generations.`}
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-tech">Landing sites</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[64rem] border-collapse text-xs">
            <thead>
              <tr className="border-b border-panel-border text-left text-ink-faint">
                <th className="py-2 pr-4">Site</th>
                <th className="py-2 pr-4">Gen</th>
                <th className="py-2 pr-4">Valley buildable</th>
                <th className="py-2 pr-4">Valley flat</th>
                <th className="py-2 pr-4">Valley ice</th>
                <th className="py-2 pr-4">Valley ore</th>
                <th className="py-2 pr-4">Height range</th>
                <th className="py-2 pr-4">Surface breakdown (whole grid)</th>
                <th className="py-2">Deposits</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ name, terrain, survey, kindCounts, elapsed }) => (
                <tr key={name} className="border-b border-panel-border/40 align-top">
                  <td className="py-2 pr-4 text-ink">{name}</td>
                  <td className="py-2 pr-4 text-ink-faint">{elapsed.toFixed(0)}ms</td>
                  <td
                    className={`py-2 pr-4 ${
                      survey.valley.buildableFraction > 0.7 ? 'text-good' : 'text-warn'
                    }`}
                  >
                    {percent(survey.valley.buildableFraction)}
                  </td>
                  <td className="py-2 pr-4">{percent(survey.valley.flatFraction)}</td>
                  <td
                    className={`py-2 pr-4 ${
                      survey.valley.iceFraction > 0.01 ? '' : 'text-alert'
                    }`}
                  >
                    {percent(survey.valley.iceFraction)}
                  </td>
                  <td className="py-2 pr-4">{survey.valley.depositTiles}</td>
                  <td className="py-2 pr-4 text-ink-dim">
                    {terrain.minHeight.toFixed(1)} .. {terrain.maxHeight.toFixed(1)}
                  </td>
                  <td className="py-2 pr-4 text-ink-dim">
                    {[...kindCounts.entries()]
                      .sort((a, b) => b[1] - a[1])
                      .map(([kind, count]) => `${TERRAIN_LABELS[kind]} ${percent(count / total)}`)
                      .join(' · ')}
                  </td>
                  <td className="py-2 text-ink-dim">
                    {Object.values(DepositKind)
                      .filter((v): v is DepositKind => typeof v === 'number' && v !== DepositKind.None)
                      .map((kind) => `${DEPOSIT_LABELS[kind]} ${survey.depositCounts[kind]}`)
                      .join(' · ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-tech">Solar curve</h2>
        <table className="border-collapse text-xs">
          <thead>
            <tr className="border-b border-panel-border text-left text-ink-faint">
              <th className="py-2 pr-6">Time</th>
              <th className="py-2 pr-6">Elevation</th>
              <th className="py-2 pr-6">Light</th>
              <th className="py-2 pr-6">PV output</th>
              <th className="py-2">Night</th>
            </tr>
          </thead>
          <tbody>
            {sunSamples.map(({ t, sun }) => (
              <tr key={t} className="border-b border-panel-border/40">
                <td className="py-1.5 pr-6">{(t * 24).toFixed(1)}h</td>
                <td className="py-1.5 pr-6 text-ink-dim">{sun.elevation.toFixed(3)}</td>
                <td className="py-1.5 pr-6 text-ink-dim">{sun.intensity.toFixed(2)}</td>
                <td className="py-1.5 pr-6 text-tech">{percent(sun.solarFactor)}</td>
                <td className="py-1.5 text-ink-dim">{sun.nightFactor.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
