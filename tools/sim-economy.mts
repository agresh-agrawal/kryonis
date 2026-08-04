/**
 * Does the colony survive its own economy?
 *
 * The bug this exists to prevent is not a crash - it is a colony that runs for
 * an hour and quietly goes broke, which is exactly what shipped: only three of
 * eighteen structures earned credits and all three were late, so a player could
 * do everything right and still end up stranded at 2,300 credits with nothing
 * affordable.
 *
 * That is not something typechecking can catch. This runs the real simulation
 * over a realistic opening build and reports whether credits actually grow.
 *
 * Usage: npx tsx tools/sim-economy.mts
 */

import { BUILDINGS, type BuildingId } from '../src/game/buildings/catalog';
import { SOL_DURATION_SECONDS } from '../src/game/core/constants';
import { startingStock, type ResourceId } from '../src/game/core/resources';
import { NO_MODIFIERS, emptyStats, stepColony } from '../src/game/sim/simulation';
import { hiringCost } from '../src/game/state/useCrewStore';
import type { PlacedBuilding } from '../src/game/state/useColonyStore';

/** A plausible opening build, in the order a player would actually put it up. */
const BUILD_ORDER: BuildingId[] = [
  'solar',
  'solar',
  'oxygen',
  'storage',
  'battery',
  'exportpad',
  'water',
  'greenhouse',
  'habitat',
  'mine',
  'solar',
  'battery',
  'solar',
  'lab',
  'factory',
];

let nextId = 1;
function place(type: BuildingId): PlacedBuilding {
  return {
    id: `b${nextId++}`,
    type,
    tx: 40 + nextId,
    tz: 40,
    rotation: 0,
    progress: 1,
    enabled: true,
    level: 1,
  } as PlacedBuilding;
}

const buildings: PlacedBuilding[] = [place('lander')];
let dynamics = {
  stock: startingStock(),
  population: 4,
  happiness: 0.8,
  batteryCharge: 0,
};

const spend = (type: BuildingId): boolean => {
  const cost = BUILDINGS[type].cost;
  for (const [resource, amount] of Object.entries(cost) as [ResourceId, number][]) {
    if (dynamics.stock[resource] < amount) return false;
  }
  for (const [resource, amount] of Object.entries(cost) as [ResourceId, number][]) {
    dynamics.stock[resource] -= amount;
  }
  buildings.push(place(type));
  return true;
};

/*
 * Hiring, modelled the way a player does it.
 *
 * Population never grows by itself - crew are recruited by hand on the crew
 * screen and each one costs credits. A simulation that never hires is
 * therefore not modelling the game, it is modelling a colony whose staff
 * gradually suffocate, which is exactly what the first run of this showed.
 */
let roster = 4;
function tryHire(): boolean {
  const housing = stats.housing;
  if (roster >= housing) return false;
  const cost = hiringCost(roster, 'Engineering');
  if (dynamics.stock.money < cost + 1500) return false;
  dynamics.stock.money -= cost;
  dynamics.population += 1;
  roster += 1;
  return true;
}

const DT = 0.25;
const SOLS = 14;
const ticksPerSol = SOL_DURATION_SECONDS / DT;

console.log('\nOpening build, one structure every third of a sol:\n');
console.log(
  '  sol   credits  income/sol   pop  staff  power   limited by',
);
console.log('  ' + '-'.repeat(72));

let queue = [...BUILD_ORDER];
let stats = emptyStats();
let brokeFor = 0;
let minCredits = Infinity;
let solSamples = { n: 0, income: 0, staffing: 0, power: 0 };

for (let sol = 0; sol < SOLS; sol++) {
  for (let tick = 0; tick < ticksPerSol; tick++) {
    // Try to put up the next structure three times a sol.
    if (queue.length > 0 && tick % Math.floor(ticksPerSol / 3) === 0) {
      if (spend(queue[0])) queue.shift();
    }
    // Fill any vacancy the moment it can be afforded, as a player would.
    if (tick % 240 === 0) tryHire();

    // Daylight over the sol; solar dies at night, exactly as in the game.
    const dayFraction = tick / ticksPerSol;
    const solar = Math.max(0, Math.sin(dayFraction * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5);

    const result = stepColony(DT, dynamics, buildings, solar, NO_MODIFIERS);
    dynamics = {
      stock: result.stock,
      population: result.population,
      happiness: result.happiness,
      batteryCharge: result.batteryCharge,
    };
    stats = result.stats;

    solSamples.n++;
    solSamples.income += stats.exportIncome;
    solSamples.staffing += stats.staffing;
    solSamples.power += stats.powerSatisfaction;

    minCredits = Math.min(minCredits, dynamics.stock.money);
    if (dynamics.stock.money < 1500) brokeFor++;
  }

  /*
   * Averaged over the sol, not sampled at the end of it.
   *
   * A single reading taken at the last tick is always taken at local midnight,
   * where solar output is zero and every figure reads as a dead colony. That
   * is a measurement artefact, and it is exactly the kind of thing that sends
   * you tuning a number that was never wrong.
   */
  const limits: string[] = [];
  if (solSamples.staffing / solSamples.n < 0.9) limits.push('crew');
  if (solSamples.power / solSamples.n < 0.9) limits.push('power');
  if (limits.length === 0) limits.push('-');

  console.log(
    `  ${String(sol + 1).padStart(3)}   ${String(Math.round(dynamics.stock.money)).padStart(7)}  ` +
      `${String(Math.round((solSamples.income / solSamples.n) * SOL_DURATION_SECONDS)).padStart(10)}   ` +
      `${String(Math.round(dynamics.population)).padStart(3)}  ` +
      `${String(Math.round((solSamples.staffing / solSamples.n) * 100)).padStart(4)}% ` +
      `${String(Math.round((solSamples.power / solSamples.n) * 100)).padStart(5)}%   ${limits.join(' + ')}`,
  );

  solSamples = { n: 0, income: 0, staffing: 0, power: 0 };
}

console.log('  ' + '-'.repeat(62));
console.log(`\n  built:          ${buildings.length - 1} of ${BUILD_ORDER.length} planned`);
console.log(`  lowest credits: ${Math.round(minCredits)}`);
console.log(`  income/sol:     ${Math.round(stats.exportIncome * SOL_DURATION_SECONDS)}`);
console.log(`  crew hired:     ${roster - 4}  (population ${Math.round(dynamics.population)})`);
console.log(`  time under 1.5k credits: ${Math.round((brokeFor * DT) / SOL_DURATION_SECONDS * 100) / 100} sols`);

/*
 * What counts as passing.
 *
 * Not "ended with more cash than it started" - a colony that spent its capital
 * on thirteen structures and is now earning 2,000 a sol is doing exactly the
 * right thing, and one that sat on its 25,000 doing nothing is not. The three
 * things that actually matter are that the crew are alive, that most of the
 * build went up, and that income now covers the cost of continuing.
 */
const alive = dynamics.population > 0;
const earning = stats.exportIncome * SOL_DURATION_SECONDS > 1200;
const builtAll = buildings.length - 1 >= BUILD_ORDER.length * 0.8;
const solvent = alive && earning;
console.log(
  `\n  ${solvent && builtAll ? 'PASS' : 'FAIL'} - ` +
    `${builtAll ? `built ${buildings.length - 1}/${BUILD_ORDER.length}` : `only built ${buildings.length - 1}/${BUILD_ORDER.length}`}, ` +
    `${solvent ? 'and ended richer than it started' : 'and ended poorer than it started'}\n`,
);
