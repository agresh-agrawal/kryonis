/**
 * Triangle cost of every procedural building, measured offline.
 *
 * The detail kit adds hardware freely on the grounds that it merges into
 * existing geometry and therefore costs no extra draw calls. That is true, but
 * "no extra draw calls" is not the same as "free" - it costs triangles, and a
 * claim about cost that is never measured is just a hope.
 *
 * This runs the real part builders in Node, so the numbers are the ones the
 * game actually ships rather than an estimate.
 *
 * Usage: npx tsx tools/count-tris.mts
 */

import { BUILDINGS, BUILDING_IDS } from '../src/game/buildings/catalog';
import { buildModel } from '../src/game/buildings/model';

interface Row {
  id: string;
  name: string;
  triangles: number;
  materials: number;
}

const rows: Row[] = [];

for (const id of BUILDING_IDS) {
  const definition = BUILDINGS[id];
  const model = buildModel(definition.buildParts());

  let triangles = 0;
  let materials = 0;
  for (const geometry of Object.values(model)) {
    if (!geometry) continue;
    materials++;
    const index = geometry.getIndex();
    const position = geometry.getAttribute('position');
    triangles += (index ? index.count : (position?.count ?? 0)) / 3;
  }

  rows.push({ id, name: definition.name, triangles: Math.round(triangles), materials });
}

rows.sort((a, b) => b.triangles - a.triangles);

const total = rows.reduce((sum, row) => sum + row.triangles, 0);

console.log('\nProcedural building geometry\n');
console.log('  tris   mats  building');
console.log('  ' + '-'.repeat(46));
for (const row of rows) {
  console.log(
    `  ${String(row.triangles).padStart(6)}  ${String(row.materials).padStart(4)}  ${row.name}`,
  );
}
console.log('  ' + '-'.repeat(46));
console.log(`  ${String(total).padStart(6)}        total across ${rows.length} structures\n`);

// A single structure much past ~8k is worth a second look: these are drawn
// 40-100px tall and instanced, so the budget is generous but not unlimited.
const heavy = rows.filter((row) => row.triangles > 8000);
if (heavy.length > 0) {
  console.log('Over 8k triangles:');
  for (const row of heavy) console.log(`  ${row.name}: ${row.triangles}`);
} else {
  console.log('Nothing over 8k triangles.');
}
