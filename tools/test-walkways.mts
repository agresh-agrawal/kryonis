/**
 * Do neighbouring walkway tiles actually meet?
 *
 * The reported fault was that tubes sat at different altitudes in different
 * regions and stepped where they joined. That is not something you can check by
 * looking at one tile - it is a property of *pairs* of tiles, on sloping
 * ground, and it is exactly the kind of thing that looks fine in a flat test
 * scene and wrong everywhere else.
 *
 * Usage: npx tsx tools/test-walkways.mts
 */

import { generateTerrain } from '../src/game/world/terrain';
import { clearRoads, setRoad } from '../src/game/world/roads';
import {
  connectionsOf,
  edgePoint,
  isStraightThrough,
  type Direction,
} from '../src/game/world/walkwayGeometry';
import { REGION_TILES } from '../src/game/core/constants';

const terrain = generateTerrain({ size: REGION_TILES, ruggedness: 0.85 });
const h = (x: number, z: number) => terrain.generator.heightAt(x, z);

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = '') {
  if (ok) passed++;
  else failed++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
}

const OPPOSITE: Record<Direction, Direction> = { nx: 'px', px: 'nx', nz: 'pz', pz: 'nz' };

// --- 1. Shared edges agree, everywhere, on rough ground --------------------
console.log('\nNeighbouring tiles agree on the height where they meet');
clearRoads();
{
  // A long run across the roughest terrain the generator makes.
  const C = Math.floor(REGION_TILES / 2);
  for (let i = -20; i <= 20; i++) setRoad(C + i, C, true);
  for (let i = -14; i <= 14; i++) setRoad(C, C + i, true);

  let worst = 0;
  let checkedPairs = 0;

  for (let i = -20; i < 20; i++) {
    const tx = C + i;
    // This tile's +X handover point, and its neighbour's -X handover point.
    const [ax, az] = edgePoint(tx, C, 'px');
    const [bx, bz] = edgePoint(tx + 1, C, OPPOSITE.px);
    const delta = Math.abs(h(ax, az) - h(bx, bz));
    worst = Math.max(worst, delta);
    checkedPairs++;
  }

  check(
    `${checkedPairs} joins on rugged terrain have zero height mismatch`,
    worst < 1e-9,
    `worst mismatch ${worst.toFixed(6)} m`,
  );
}

// --- 2. The edge point really is shared -----------------------------------
console.log('\nThe handover point is the same world position for both tiles');
{
  const C = Math.floor(REGION_TILES / 2);
  const [ax, az] = edgePoint(C, C, 'pz');
  const [bx, bz] = edgePoint(C, C + 1, 'nz');
  check('same X', Math.abs(ax - bx) < 1e-9, `${ax} vs ${bx}`);
  check('same Z', Math.abs(az - bz) < 1e-9, `${az} vs ${bz}`);
}

// --- 3. Junction shapes are classified correctly ---------------------------
console.log('\nJunctions are recognised for what they are');
clearRoads();
{
  const C = 40;
  // A cross: centre with all four neighbours.
  setRoad(C, C, true);
  setRoad(C - 1, C, true);
  setRoad(C + 1, C, true);
  setRoad(C, C - 1, true);
  setRoad(C, C + 1, true);
  const cross = connectionsOf(C, C);
  check('crossroads has four stubs', cross.length === 4, `got ${cross.length}`);
  check('crossroads is not a straight run', !isStraightThrough(cross));
}

clearRoads();
{
  const C = 40;
  // A T: three neighbours.
  setRoad(C, C, true);
  setRoad(C - 1, C, true);
  setRoad(C + 1, C, true);
  setRoad(C, C + 1, true);
  const tee = connectionsOf(C, C);
  check('T-junction has three stubs', tee.length === 3, `got ${tee.length}`);
  check('T-junction gets a collar', !isStraightThrough(tee));
}

clearRoads();
{
  const C = 40;
  // A corner: two neighbours, not opposite.
  setRoad(C, C, true);
  setRoad(C - 1, C, true);
  setRoad(C, C + 1, true);
  const corner = connectionsOf(C, C);
  check('corner has two stubs', corner.length === 2, `got ${corner.length}`);
  check('corner gets a collar', !isStraightThrough(corner));
}

clearRoads();
{
  const C = 40;
  // A straight: two opposite neighbours.
  setRoad(C - 1, C, true);
  setRoad(C, C, true);
  setRoad(C + 1, C, true);
  const straight = connectionsOf(C, C);
  check('straight has two stubs', straight.length === 2, `got ${straight.length}`);
  check('straight gets no collar', isStraightThrough(straight));
}

console.log(`\n  ${failed === 0 ? 'ALL PASS' : `${failed} FAILED`} — ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
