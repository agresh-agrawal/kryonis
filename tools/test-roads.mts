/**
 * Does the road network behave the way the rules say?
 *
 * Connectivity bugs are invisible from the outside - a building either works or
 * it does not, and if the rule is wrong the game just feels arbitrary. These are
 * the cases that matter, checked against the real solver.
 *
 * Usage: npx tsx tools/test-roads.mts
 */

import { REGION_TILES } from '../src/game/core/constants';
import {
  clearRoads,
  serviceOf,
  serviceProblem,
  setRoad,
  solveNetworks,
} from '../src/game/world/roads';
import type { PlacedBuilding } from '../src/game/state/useColonyStore';
import type { BuildingId } from '../src/game/buildings/catalog';

let id = 0;
function at(type: BuildingId, tx: number, tz: number): PlacedBuilding {
  return {
    id: `b${++id}`,
    type,
    tx,
    tz,
    rotation: 0,
    progress: 1,
    enabled: true,
    level: 1,
  } as PlacedBuilding;
}

function road(tx: number, tz: number, length: number, axis: 'x' | 'z' = 'x') {
  for (let i = 0; i < length; i++) {
    setRoad(axis === 'x' ? tx + i : tx, axis === 'x' ? tz : tz + i, true);
  }
}

let passed = 0;
let failed = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  if (ok) passed++;
  else failed++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (got ${actual}, wanted ${expected})`}`);
}

const C = Math.floor(REGION_TILES / 2);

// --- 1. A building with no road at all is not connected --------------------
console.log('\nA structure with no road nearby');
clearRoads();
{
  const solar = at('solar', C, C);
  const oxygen = at('oxygen', C + 6, C);
  solveNetworks([solar, oxygen]);
  check('is not connected', serviceOf(oxygen.id).connected, false);
  check('is not operational', serviceOf(oxygen.id).operational, false);
  check('says why', serviceProblem(oxygen), 'Not connected to a road');
}

// --- 2. A road with a generator on it powers a consumer --------------------
console.log('\nA generator and a consumer on the same road');
clearRoads();
{
  // Road running east-west at tz = C + 2; both structures sit just above it.
  road(C, C + 2, 12);
  const solar = at('solar', C, C);
  const oxygen = at('oxygen', C + 6, C);
  solveNetworks([solar, oxygen]);
  check('consumer is connected', serviceOf(oxygen.id).connected, true);
  check('consumer has power', serviceOf(oxygen.id).hasPower, true);
  check('consumer is operational', serviceOf(oxygen.id).operational, true);
  check('no problem reported', serviceProblem(oxygen), null);
}

// --- 3. Two unconnected roads are two separate grids -----------------------
console.log('\nA generator on a road that does not reach the consumer');
clearRoads();
{
  road(C, C + 2, 3); // generator's road
  road(C + 8, C + 2, 3); // consumer's road, with a gap between them
  const solar = at('solar', C, C);
  const oxygen = at('oxygen', C + 8, C);
  const networks = solveNetworks([solar, oxygen]);
  check('there are two grids', networks.count, 2);
  check('consumer is connected to a road', serviceOf(oxygen.id).connected, true);
  check('but has no power', serviceOf(oxygen.id).hasPower, false);
  check('so it is not operational', serviceOf(oxygen.id).operational, false);
  check('and says why', serviceProblem(oxygen), 'No power on this road');
}

// --- 4. Joining the two roads energises the far one ------------------------
console.log('\nJoining the two roads');
{
  road(C + 3, C + 2, 5); // bridge the gap
  const solar = at('solar', C, C);
  const oxygen = at('oxygen', C + 8, C);
  const networks = solveNetworks([solar, oxygen]);
  check('now one grid', networks.count, 1);
  check('consumer has power', serviceOf(oxygen.id).hasPower, true);
  check('consumer is operational', serviceOf(oxygen.id).operational, true);
}

// --- 5. Water is a separate utility on the same road -----------------------
console.log('\nA greenhouse needs water, not just power');
clearRoads();
{
  road(C, C + 2, 16);
  const solar = at('solar', C, C);
  const greenhouse = at('greenhouse', C + 6, C);
  solveNetworks([solar, greenhouse]);
  check('has power', serviceOf(greenhouse.id).hasPower, true);
  check('has no water yet', serviceOf(greenhouse.id).hasWater, false);
  check('so it is not operational', serviceOf(greenhouse.id).operational, false);
  check('and says which utility', serviceProblem(greenhouse), 'No water on this road');

  // Plumb an extractor into the same road.
  const water = at('water', C + 12, C);
  solveNetworks([solar, greenhouse, water]);
  check('extractor pressurises the main', serviceOf(greenhouse.id).hasWater, true);
  check('greenhouse now runs', serviceOf(greenhouse.id).operational, true);
}

// --- 6. The hub never needs a road -----------------------------------------
console.log('\nThe colony hub');
clearRoads();
{
  const hub = at('lander', C, C);
  solveNetworks([hub]);
  check('works with no roads at all', serviceOf(hub.id).operational, true);
  check('reports no problem', serviceProblem(hub), null);
}

// --- 7. Diagonal touching is not a connection ------------------------------
console.log('\nA road touching only the corner');
clearRoads();
{
  const solar = at('solar', C, C); // occupies C..C+1 on both axes
  // Place a single road tile diagonally off the corner.
  setRoad(C + 2, C + 2, true);
  const networks = solveNetworks([solar]);
  check('one road tile exists', networks.tiles, 1);
  check('but the structure is not connected', serviceOf(solar.id).connected, false);
}

console.log(`\n  ${failed === 0 ? 'ALL PASS' : `${failed} FAILED`} — ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
