/**
 * Procedural models for every structure in the colony.
 *
 * Each function returns a part list that `buildModel` bakes into merged
 * geometry. The design language is deliberately drawn from real programmes -
 * Kilopower reactors, MOXIE oxygen production, inflatable habitats buried under
 * regolith for radiation shielding - because plausible hardware is what makes a
 * procedurally generated colony read as engineered rather than decorative.
 */

import * as THREE from 'three';

import {
  boltRow,
  controlPanel,
  crates,
  crops,
  deckRail,
  handrail,
  ladder,
  pipeRun,
  ventGrille,
} from './detailKit';
import {
  accentBand,
  airlock,
  antenna,
  box,
  capsule,
  cylinder,
  dome,
  foundation,
  pressureDome,
  legs,
  radiator,
  taperedCylinder,
  tank,
  torus,
  unitCone,
  unitSphere,
  vault,
  viewports,
  type Part,
} from './model';

// ---------------------------------------------------------------------------
// Command Lander - the structure every colony starts with.
// ---------------------------------------------------------------------------

export function landerParts(): Part[] {
  const parts: Part[] = [];

  // Splayed landing legs with footpads.
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const x = Math.cos(angle);
    const z = Math.sin(angle);
    parts.push({
      geo: cylinder(0.1, 2.6, 8),
      mat: 'metal',
      pos: [x * 1.5, 1.0, z * 1.5],
      rot: [z * 0.42, 0, -x * 0.42],
    });
    parts.push({ geo: cylinder(0.34, 0.12, 12), mat: 'metal', pos: [x * 2.15, 0.06, z * 2.15] });
  }

  // Octagonal descent stage wrapped in gold thermal blanket.
  parts.push({ geo: taperedCylinder(1.5, 1.7, 1.1, 8), mat: 'gold', pos: [0, 2.05, 0] });
  parts.push({ geo: torus(1.55, 0.09, 8), mat: 'metal', pos: [0, 1.55, 0], rot: [Math.PI / 2, 0, 0] });

  // Descent engine bells.
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    parts.push({
      geo: unitCone(),
      mat: 'dark',
      pos: [Math.cos(angle) * 0.62, 1.2, Math.sin(angle) * 0.62],
      rot: [Math.PI, 0, 0],
      scale: [0.3, 0.62, 0.3],
    });
  }

  // Crew ascent module.
  parts.push({ geo: taperedCylinder(1.05, 1.35, 1.5, 12), mat: 'hull', pos: [0, 3.35, 0] });
  parts.push({ geo: dome(1.05, 16), mat: 'hull', pos: [0, 4.1, 0] });
  parts.push(...accentBand([0, 3.0, 0], 1.32));
  parts.push(...viewports(4, [0.95, 3.7, 0.55], [-0.62, 0, -0.36], 0.15));

  // Deployed solar wings.
  for (const side of [-1, 1]) {
    parts.push({
      geo: box(2.1, 0.05, 1.15),
      mat: 'solar',
      pos: [side * 2.35, 3.1, 0],
      rot: [0, 0, side * 0.12],
    });
    parts.push({ geo: cylinder(0.06, 1.0, 6), mat: 'metal', pos: [side * 1.6, 3.1, 0], rot: [0, 0, Math.PI / 2] });
  }

  parts.push(...antenna([0.8, 4.2, 0.8], 1.5, true));
  parts.push(...airlock([0, 2.6, 1.55], 0, 1.0, 0.4));

  return parts;
}

// ---------------------------------------------------------------------------
// Habitation
// ---------------------------------------------------------------------------

export function habitatParts(): Part[] {
  const parts: Part[] = [...foundation(5.4, 5.4)];

  // Regolith berm piled against the shell - the cheapest radiation shielding
  // available on Mars, and the reason real habitat concepts are half-buried.
  parts.push({ geo: taperedCylinder(2.55, 3.0, 0.85, 24), mat: 'concrete', pos: [0, 0.6, 0] });
  parts.push({ geo: box(3.8, 0.2, 3.8), mat: 'soil', pos: [0, 0.3, 0] });

  parts.push({ geo: pressureDome(2.4, 28), mat: 'hull', pos: [0, 0.95, 0] });
  parts.push({ geo: torus(2.4, 0.07, 24), mat: 'metal', pos: [0, 1.0, 0], rot: [Math.PI / 2, 0, 0] });
  parts.push(...accentBand([0, 1.55, 0], 2.22));

  // Viewports ringing the pressurised shell.
  const ports: Part[] = [];
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    ports.push({
      geo: unitSphere(),
      mat: 'window',
      pos: [Math.cos(angle) * 2.3, 1.5, Math.sin(angle) * 2.3],
      scale: 0.2,
    });
  }
  parts.push(...ports);

  parts.push(...airlock([0, 1.15, 2.75], 0, 1.3, 0.5));
  parts.push(...antenna([1.7, 1.9, -1.7], 1.6, false));

  // Roof-mounted life-support trunk.
  parts.push({ geo: cylinder(0.28, 0.7, 10), mat: 'metal', pos: [0, 3.4, 0] });
  parts.push({ geo: box(0.7, 0.12, 0.7), mat: 'metal', pos: [0, 3.82, 0] });
  parts.push({ geo: unitSphere(), mat: 'hazard', pos: [0, 3.85, 0], scale: 0.12 });

  // Service walkways to make the habitat feel built rather than dropped.
  parts.push({ geo: box(1.15, 0.08, 0.35), mat: 'metal', pos: [1.7, 0.15, 0] });
  parts.push(...handrail([1.25, 0.18, -0.2], [2.15, 0.18, -0.2], 0.32));
  parts.push({ geo: box(1.15, 0.08, 0.35), mat: 'metal', pos: [-1.7, 0.15, 0] });
  parts.push(...handrail([-2.15, 0.18, -0.2], [-1.25, 0.18, -0.2], 0.32));

  return parts;
}

export function corridorParts(): Part[] {
  return [
    { geo: capsule(0.45, 1.4), mat: 'hull', pos: [0, 0.62, 0] },
    { geo: torus(0.47, 0.05, 14), mat: 'metal', pos: [-0.55, 0.62, 0], rot: [0, Math.PI / 2, 0] },
    { geo: torus(0.47, 0.05, 14), mat: 'metal', pos: [0.55, 0.62, 0], rot: [0, Math.PI / 2, 0] },
    ...viewports(2, [-0.3, 0.75, 0.42], [0.6, 0, 0], 0.11),

    // Cable and air ducting clipped along the outside of the tube. A bare
    // pressurised tube looks unfinished; a serviced one looks connected.
    { geo: cylinder(0.045, 1.5, 6), mat: 'dark', pos: [0, 0.28, 0.4], rot: [0, 0, Math.PI / 2] },
    { geo: cylinder(0.045, 1.5, 6), mat: 'dark', pos: [0, 0.28, -0.4], rot: [0, 0, Math.PI / 2] },
    { geo: box(0.16, 0.1, 0.1), mat: 'metal', pos: [-0.4, 0.28, 0.4] },
    { geo: box(0.16, 0.1, 0.1), mat: 'metal', pos: [0.4, 0.28, -0.4] },

    // Floodlight on the tunnel side - these are the paths crew walk at night.
    { geo: box(0.14, 0.1, 0.1), mat: 'window', pos: [0, 0.95, 0.4] },

    ...foundation(2.2, 1.4, 0.12),
  ];
}

export function roadParts(): Part[] {
  const parts: Part[] = [];
  parts.push({ geo: box(1.2, 0.06, 1.2), mat: 'concrete', pos: [0, 0.03, 0] });
  parts.push({ geo: box(0.1, 0.08, 1.06), mat: 'metal', pos: [0, 0.08, 0] });
  parts.push({ geo: box(0.92, 0.04, 0.06), mat: 'accent', pos: [0, 0.12, 0.42] });
  parts.push({ geo: box(0.92, 0.04, 0.06), mat: 'accent', pos: [0, 0.12, -0.42] });
  parts.push({ geo: cylinder(0.045, 0.2, 8), mat: 'dark', pos: [0.28, 0.12, 0.28], rot: [0, 0, Math.PI / 2] });
  parts.push({ geo: cylinder(0.045, 0.2, 8), mat: 'dark', pos: [-0.28, 0.12, -0.28], rot: [0, 0, Math.PI / 2] });
  return parts;
}

// ---------------------------------------------------------------------------
// Power
// ---------------------------------------------------------------------------

/**
 * The solar array.
 *
 * Worth more care than anything else in the catalog, because there will be
 * dozens of them on screen and they are the first thing a player ever builds.
 * A real tracking array is not three slabs on posts - it is a torque tube on
 * bearings, driven by an actuator, feeding a combiner box through cable trays,
 * and every one of those parts is visible from above.
 */
export function solarFarmParts(): Part[] {
  const parts: Part[] = [...foundation(3.7, 3.7, 0.12)];

  for (let row = 0; row < 3; row++) {
    const z = (row - 1) * 1.15;

    // The panel: individual cells rather than one dark slab. Real modules are
    // a grid, and the grid is what catches the low sun as a pattern instead of
    // as a flat sheet.
    for (let cell = 0; cell < 6; cell++) {
      const x = -1.38 + cell * 0.552;
      parts.push({
        geo: box(0.5, 0.05, 0.9),
        mat: 'solar',
        pos: [x, 0.72, z],
        rot: [-0.52, 0, 0],
      });
    }

    // Frame, torque tube and the bearing posts it turns in.
    parts.push({ geo: box(3.36, 0.04, 1.02), mat: 'metal', pos: [0, 0.7, z], rot: [-0.52, 0, 0] });
    parts.push({ geo: cylinder(0.05, 3.3, 8), mat: 'metal', pos: [0, 0.62, z], rot: [0, 0, Math.PI / 2] });

    for (const x of [-1.3, 1.3]) {
      parts.push({ geo: cylinder(0.07, 0.62, 8), mat: 'metal', pos: [x, 0.31, z] });
      // Bearing housing at the top of each post.
      parts.push({ geo: cylinder(0.11, 0.14, 10), mat: 'dark', pos: [x, 0.62, z], rot: [0, 0, Math.PI / 2] });
      // Foot plate, bolted down.
      parts.push({ geo: box(0.26, 0.05, 0.26), mat: 'metal', pos: [x, 0.14, z] });
    }

    // Slew actuator on the centre of the tube - the thing that does the
    // tracking. Without it the array is a static panel pretending to track.
    parts.push({ geo: box(0.3, 0.26, 0.34), mat: 'dark', pos: [0, 0.6, z] });
    parts.push({ geo: cylinder(0.05, 0.32, 8), mat: 'metal', pos: [0.2, 0.5, z], rot: [0, 0, 0.7] });

    // Cable drop from the row into the trench.
    parts.push(...pipeRun([1.3, 0.55, z], [1.3, 0.16, z + 0.3], 0.035, 'dark'));
  }

  // Cable tray running the rows back to the inverter.
  parts.push({ geo: box(0.16, 0.07, 2.6), mat: 'dark', pos: [1.3, 0.18, 0] });

  // --- Power conditioning ------------------------------------------------
  parts.push({ geo: box(0.72, 0.85, 0.5), mat: 'hull', pos: [1.35, 0.55, 1.5] });
  parts.push({ geo: box(0.5, 0.1, 0.04), mat: 'accent', pos: [1.35, 0.82, 1.76] });
  parts.push(...ventGrille([1.35, 0.5, 1.77], 0.5, 0.3));
  parts.push(...boltRow([1.0, 0.96, 1.5], [1.7, 0.96, 1.5], 4, 0.018));

  // The panel that tells a passing technician what the array is doing.
  parts.push(...controlPanel([1.35, 1.12, 1.62], 0, 0.62));

  return parts;
}

export function reactorParts(): Part[] {
  const parts: Part[] = [...foundation(3.7, 3.7)];

  // Buried shield plug with the reactor core above it.
  parts.push({ geo: taperedCylinder(0.95, 1.25, 0.8, 16), mat: 'concrete', pos: [0, 0.58, 0] });
  parts.push({ geo: cylinder(0.62, 1.35, 16), mat: 'gold', pos: [0, 1.65, 0] });
  parts.push({ geo: pressureDome(0.62, 16), mat: 'metal', pos: [0, 2.32, 0] });
  parts.push(...accentBand([0, 1.15, 0], 0.66));

  // Heat-rejection radiators - a fission plant is mostly a radiator.
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    parts.push(
      ...radiator(
        [Math.cos(angle) * 1.35, 1.5, Math.sin(angle) * 1.35],
        1.5,
        1.4,
        -angle + Math.PI / 2,
      ),
    );
  }

  parts.push({ geo: unitSphere(), mat: 'hazard', pos: [0, 2.62, 0], scale: 0.14 });
  return parts;
}

// ---------------------------------------------------------------------------
// Life support
// ---------------------------------------------------------------------------

export function oxygenPlantParts(): Part[] {
  const parts: Part[] = [...foundation(3.7, 3.7)];

  // Atmospheric intake stack: Mars air is 95% CO2, and that is the feedstock.
  parts.push({ geo: box(1.5, 1.5, 1.1), mat: 'hull', pos: [-0.85, 0.93, -0.6] });
  for (const z of [-0.95, -0.25]) {
    parts.push({ geo: cylinder(0.3, 0.14, 14), mat: 'dark', pos: [-0.85, 1.7, z] });
    parts.push({ geo: cylinder(0.26, 0.06, 12), mat: 'metal', pos: [-0.85, 1.79, z] });
  }

  // Electrolysis stack.
  parts.push({ geo: box(1.05, 1.7, 0.9), mat: 'metal', pos: [0.75, 1.03, -0.55] });
  parts.push({ geo: box(0.85, 0.12, 0.06), mat: 'accent', pos: [0.75, 1.72, -0.11] });

  // Product tanks.
  parts.push(...tank([-0.75, 0.18, 1.15], 0.46, 1.3, 'hull'));
  parts.push(...tank([0.5, 0.18, 1.2], 0.38, 1.05, 'hull'));

  // Interconnect piping, now flanged where it meets each vessel.
  parts.push(...pipeRun([-0.95, 0.75, -0.6], [0.85, 0.75, -0.6], 0.075));
  parts.push(...pipeRun([-0.1, 0.5, -0.35], [-0.1, 0.5, 1.05], 0.065));

  // Compressor skid feeding the electrolyser: the plant needs pressure before
  // it needs anything else.
  parts.push({ geo: box(0.62, 0.4, 0.5), mat: 'dark', pos: [0.05, 0.38, 0.05] });
  parts.push({ geo: cylinder(0.14, 0.44, 10), mat: 'metal', pos: [0.05, 0.68, 0.05], rot: [0, 0, Math.PI / 2] });

  // Waste-heat vents on the stack, and access to the top of it.
  parts.push(...ventGrille([1.29, 1.2, -0.55], 0.5, 0.5, Math.PI / 2));
  parts.push(...ladder([0.75, 0.18, 0.0], 1.7, 0));

  // Operator station, and a bolted inspection hatch on the intake housing.
  parts.push(...controlPanel([-0.85, 1.05, 0.0], 0, 0.85));
  parts.push(...boltRow([-1.55, 1.68, -0.6], [-0.15, 1.68, -0.6], 6, 0.02));

  parts.push({ geo: unitSphere(), mat: 'hazard', pos: [0.75, 1.95, -0.55], scale: 0.09 });
  return parts;
}

export function iceExtractorParts(): Part[] {
  const parts: Part[] = [...foundation(3.7, 3.7)];

  // Drill derrick.
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    parts.push({
      geo: cylinder(0.06, 2.4, 6),
      mat: 'metal',
      pos: [Math.cos(angle) * 0.5, 1.35, Math.sin(angle) * 0.5],
      rot: [Math.sin(angle) * 0.14, 0, -Math.cos(angle) * 0.14],
    });
  }
  parts.push({ geo: box(0.9, 0.12, 0.9), mat: 'metal', pos: [0, 2.5, 0] });
  parts.push({ geo: cylinder(0.16, 1.9, 10), mat: 'dark', pos: [0, 1.2, 0] });
  parts.push({ geo: unitCone(), mat: 'metal', pos: [0, 0.28, 0], rot: [Math.PI, 0, 0], scale: [0.22, 0.4, 0.22] });

  // Sublimation heater and condenser drum.
  parts.push({ geo: cylinder(0.55, 0.95, 16), mat: 'hull', pos: [1.15, 0.65, 0.55], rot: [0, 0, Math.PI / 2] });
  parts.push({ geo: torus(0.57, 0.06, 16), mat: 'accent', pos: [1.15, 0.65, 0.55], rot: [0, 0, Math.PI / 2] });

  // Melt-water holding tank.
  parts.push(...tank([-1.15, 0.18, 0.95], 0.42, 1.0, 'hull'));

  // --- Working detail ----------------------------------------------------
  // Derrick cross-bracing. Four bare legs read as a tent; braced legs read as
  // a structure meant to take the torque of a drill.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const b = ((i + 1) / 4) * Math.PI * 2 + Math.PI / 4;
    for (const y of [0.9, 1.8]) {
      parts.push(
        ...pipeRun(
          [Math.cos(a) * 0.5, y, Math.sin(a) * 0.5],
          [Math.cos(b) * 0.5, y, Math.sin(b) * 0.5],
          0.028,
        ),
      );
    }
  }

  // Winch head and cable running down the bore.
  parts.push({ geo: box(0.34, 0.24, 0.3), mat: 'dark', pos: [0, 2.72, 0] });
  parts.push({ geo: cylinder(0.012, 1.2, 5), mat: 'metal', pos: [0.14, 2.05, 0] });

  // Heated line from the condenser to the holding tank - on Mars this is the
  // part that must not freeze.
  parts.push(...pipeRun([0.62, 0.65, 0.55], [-0.75, 0.62, 0.95], 0.06));
  parts.push(...pipeRun([-1.15, 0.95, 0.95], [-1.15, 1.15, 0.3], 0.05));

  // Access ladder up the derrick, and the driller's console at the base.
  parts.push(...ladder([0, 0.18, 0.62], 2.3, 0));
  parts.push(...controlPanel([1.15, 1.25, 0.05], 0, 0.8));
  parts.push(...crates([-1.2, 0.18, -1.15], 88, 2));

  parts.push({ geo: unitSphere(), mat: 'hazard', pos: [0, 2.7, 0], scale: 0.1 });
  return parts;
}

/**
 * The greenhouse.
 *
 * The one building in the colony that is supposed to look *alive*, and the one
 * that most obviously did not: three green boxes on three trays, which read as
 * slabs of paint under glass.
 *
 * What is here now is a real growing house — raised beds of dark soil with
 * individually generated crops standing in them, lamp bars over each row,
 * irrigation running along the bed edges, and a service walkway down the
 * middle with a rail. The plants are the point; everything else exists to
 * explain how they are being kept alive nine months from Earth.
 */
export function greenhouseParts(): Part[] {
  const parts: Part[] = [...foundation(5.6, 3.6)];

  // --- Shell -------------------------------------------------------------
  parts.push({ geo: vault(1.45, 5.0, 24), mat: 'glass', pos: [0, 0.2, 0] });

  // Structural ribs over the glazing.
  for (let i = 0; i < 7; i++) {
    const x = -2.4 + i * 0.8;
    parts.push({
      geo: torus(1.46, 0.052, 20),
      mat: 'metal',
      pos: [x, 0.2, 0],
      rot: [0, Math.PI / 2, 0],
    });
  }

  // Ridge beam along the top of the vault.
  parts.push({ geo: box(5.0, 0.09, 0.12), mat: 'metal', pos: [0, 1.63, 0] });

  // End walls, with a vent in the far one — a sealed glasshouse cooks.
  for (const x of [-2.52, 2.52]) {
    parts.push({
      geo: cylinder(1.45, 0.08, 20),
      mat: 'hull',
      pos: [x, 0.2, 0],
      rot: [0, 0, Math.PI / 2],
    });
  }
  parts.push(...ventGrille([-2.58, 1.0, 0], 0.7, 0.44, Math.PI / 2));

  // --- Growing beds ------------------------------------------------------
  const bedZ = [-0.78, 0, 0.78];
  bedZ.forEach((z, index) => {
    // Raised planter: walls, then soil sunk inside them, so the bed reads as a
    // container of earth rather than a painted block.
    parts.push({ geo: box(4.6, 0.3, 0.62), mat: 'metal', pos: [0, 0.34, z] });
    parts.push({ geo: box(4.44, 0.22, 0.48), mat: 'soil', pos: [0, 0.42, z] });

    // The crop itself. A different seed per bed so no two rows match, and the
    // middle bed is planted denser because it gets the most light.
    parts.push(
      ...crops([0, 0.52, z], 4.3, 0.44, 4100 + index * 137, index === 1 ? 1.15 : 1),
    );

    // Irrigation line along the bed edge, with drippers.
    parts.push({ geo: cylinder(0.03, 4.4, 6), mat: 'metal', pos: [0, 0.5, z - 0.3], rot: [0, 0, Math.PI / 2] });

    // Lamp bar above the row: housing plus the lit element.
    parts.push({ geo: box(4.3, 0.1, 0.16), mat: 'dark', pos: [0, 1.32, z] });
    parts.push({ geo: box(4.16, 0.05, 0.1), mat: 'window', pos: [0, 1.27, z] });

    // Hangers holding the lamp bar off the ridge.
    for (const x of [-1.6, 0, 1.6]) {
      parts.push({ geo: cylinder(0.014, 0.3, 5), mat: 'metal', pos: [x, 1.47, z] });
    }
  });

  // --- Working hardware --------------------------------------------------
  // Service walkway between the beds, with a rail on one side only — the other
  // side is where you reach in to pick.
  parts.push({ geo: box(4.6, 0.04, 0.34), mat: 'concrete', pos: [0, 0.2, 0.39] });
  parts.push(...handrail([-2.2, 0.22, 0.39], [2.2, 0.22, 0.39], 0.36));

  // Nutrient tanks and the pipework feeding the beds.
  parts.push({ geo: cylinder(0.24, 0.72, 12), mat: 'hull', pos: [-1.95, 0.56, -1.28] });
  parts.push({ geo: cylinder(0.24, 0.72, 12), mat: 'hull', pos: [-1.42, 0.56, -1.28] });
  parts.push(...pipeRun([-1.95, 0.9, -1.28], [-1.95, 0.5, -0.78], 0.045));
  parts.push(...pipeRun([-1.42, 0.9, -1.28], [-1.42, 0.5, -0.78], 0.045));

  // Climate console by the door: this is a controlled environment, and somebody
  // controls it.
  parts.push(...controlPanel([2.28, 0.95, -0.62], Math.PI / 2, 0.9));

  parts.push(...airlock([2.9, 0.6, 0], Math.PI / 2, 1.0, 0.42));
  return parts;
}

// ---------------------------------------------------------------------------
// Industry
// ---------------------------------------------------------------------------

export function mineParts(): Part[] {
  const parts: Part[] = [...foundation(3.7, 3.7)];

  // Excavation pit lining.
  parts.push({ geo: taperedCylinder(1.15, 0.85, 0.4, 16), mat: 'dark', pos: [-0.6, 0.2, -0.6] });

  // Bucket-wheel boom over the pit.
  parts.push({ geo: box(0.9, 1.2, 0.9), mat: 'hull', pos: [0.75, 0.78, 0.65] });
  parts.push({ geo: box(2.4, 0.14, 0.28), mat: 'metal', pos: [-0.15, 1.15, 0.1], rot: [0, 0.72, -0.26] });
  parts.push({ geo: torus(0.42, 0.13, 12), mat: 'metal', pos: [-1.05, 0.78, -0.5], rot: [0, 0.72, -0.26] });

  // Ore hopper and conveyor.
  parts.push({ geo: taperedCylinder(0.32, 0.78, 0.95, 8), mat: 'metal', pos: [1.0, 1.5, -0.75] });
  parts.push({ geo: box(1.9, 0.1, 0.42), mat: 'dark', pos: [0.35, 1.0, -0.75], rot: [0, 0, 0.3] });

  // Bucket-wheel teeth: the detail that says "this digs" rather than "this is
  // a wheel". Six buckets around the rim, angled into the cut.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    parts.push({
      geo: box(0.17, 0.2, 0.17),
      mat: 'dark',
      pos: [
        -1.05 + Math.cos(a) * 0.32,
        0.78 + Math.sin(a) * 0.42,
        -0.5 + Math.cos(a) * 0.27,
      ],
      rot: [0, 0.72, -0.26 + a],
    });
  }

  // Rollers carrying the conveyor belt.
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    parts.push({
      geo: cylinder(0.055, 0.44, 6),
      mat: 'metal',
      pos: [-0.6 + t * 1.9, 0.72 + t * 0.56, -0.75],
      rot: [0, 0, Math.PI / 2],
    });
  }

  // Spoil heaps beside the pit - ore that has already come out of the ground.
  parts.push({ geo: unitCone(), mat: 'soil', pos: [-1.35, 0.18, 1.15], scale: [0.72, 0.42, 0.72] });
  parts.push({ geo: unitCone(), mat: 'soil', pos: [-0.75, 0.18, 1.45], scale: [0.5, 0.3, 0.5] });

  // Discharge chute, operator cab and access.
  parts.push(...pipeRun([1.0, 1.02, -0.75], [1.0, 0.42, -1.3], 0.11));
  parts.push(...controlPanel([1.28, 1.05, 0.65], -Math.PI / 2, 0.8));
  parts.push(...ladder([0.75, 0.18, 1.18], 1.3, 0));
  parts.push(...ventGrille([0.28, 0.9, 0.65], 0.4, 0.4, Math.PI / 2));

  parts.push(...accentBand([0.75, 1.42, 0.65], 0.5));
  parts.push({ geo: unitSphere(), mat: 'hazard', pos: [0.75, 1.5, 0.65], scale: 0.1 });
  return parts;
}

export function storageParts(): Part[] {
  const parts: Part[] = [...foundation(3.7, 3.7)];

  const layout: [number, number, number, number][] = [
    [-0.85, -0.85, 0.5, 1.5],
    [0.85, -0.8, 0.42, 1.15],
    [-0.8, 0.9, 0.42, 1.0],
    [0.9, 0.9, 0.55, 1.35],
  ];
  for (const [x, z, radius, height] of layout) {
    parts.push(...tank([x, 0.18, z], radius, height, 'hull'));
  }

  // Service gantry linking the tank tops, now a walkway somebody can use:
  // decking, a rail along it, and a ladder up to it.
  parts.push({ geo: box(2.5, 0.08, 0.42), mat: 'metal', pos: [0, 1.15, -0.85] });
  parts.push({ geo: box(0.42, 0.08, 2.4), mat: 'metal', pos: [-0.85, 1.15, 0] });
  parts.push(...handrail([-1.25, 1.19, -1.03], [1.25, 1.19, -1.03], 0.44));
  parts.push(...handrail([-1.06, 1.19, -1.2], [-1.06, 1.19, 1.2], 0.44));
  parts.push(...ladder([1.32, 0.18, -1.0], 1.0, 0));

  // Manifold and header pipe: tanks that are not plumbed to anything are
  // barrels, not storage.
  parts.push(...pipeRun([-0.85, 0.62, -0.85], [0.85, 0.62, -0.8], 0.06));
  parts.push(...pipeRun([-0.8, 0.62, 0.9], [0.9, 0.62, 0.9], 0.06));
  parts.push(...pipeRun([-0.85, 0.45, -0.6], [-0.8, 0.45, 0.65], 0.06));

  // Fill point with a gauge board, where a rover would couple up.
  parts.push({ geo: box(0.42, 0.5, 0.3), mat: 'dark', pos: [1.5, 0.43, 1.55] });
  parts.push(...controlPanel([1.5, 0.78, 1.55], 0, 0.6));
  parts.push(...crates([0.1, 0.18, 1.5], 1207, 3));

  parts.push(...accentBand([-0.85, 1.05, -0.85], 0.53));

  return parts;
}

export function factoryParts(): Part[] {
  const parts: Part[] = [...foundation(5.6, 3.6)];

  // Long fabrication hall.
  parts.push({ geo: box(4.8, 1.5, 2.9), mat: 'hull', pos: [0, 0.95, 0] });
  parts.push({ geo: vault(1.5, 4.8, 20), mat: 'metal', pos: [0, 1.7, 0], scale: [1, 0.55, 0.97] });
  parts.push({ geo: box(4.9, 0.12, 0.1), mat: 'accent', pos: [0, 1.62, 1.46] });

  // Exhaust stacks and heat exchangers.
  for (const x of [-1.5, 0, 1.5]) {
    parts.push({ geo: cylinder(0.2, 1.0, 10), mat: 'dark', pos: [x, 2.5, -0.7] });
    parts.push({ geo: torus(0.22, 0.05, 10), mat: 'metal', pos: [x, 2.95, -0.7], rot: [Math.PI / 2, 0, 0] });
  }

  parts.push(...viewports(5, [-1.9, 1.15, 1.48], [0.95, 0, 0], 0.16));
  parts.push(...radiator([-2.75, 1.3, 0], 1.6, 1.3, Math.PI / 2));
  parts.push({ geo: unitSphere(), mat: 'hazard', pos: [2.3, 2.2, -1.3], scale: 0.1 });
  return parts;
}

// ---------------------------------------------------------------------------
// Science and medical
// ---------------------------------------------------------------------------

export function labParts(): Part[] {
  const parts: Part[] = [...foundation(5.6, 3.6)];

  // Two pressurised modules joined by a node.
  for (const z of [-0.8, 0.8]) {
    parts.push({ geo: capsule(0.85, 3.2), mat: 'hull', pos: [0, 1.05, z] });
    parts.push(...viewports(4, [-1.35, 1.25, z + 0.62], [0.9, 0, 0], 0.15));
  }
  parts.push({ geo: cylinder(0.5, 1.7, 14), mat: 'metal', pos: [0, 1.05, 0], rot: [Math.PI / 2, 0, 0] });
  parts.push(...accentBand([-1.75, 1.05, -0.8], 0.87));
  parts.push(...accentBand([-1.75, 1.05, 0.8], 0.87));

  // Instrument deck, railed - people work up here.
  parts.push({ geo: box(1.3, 0.1, 1.3), mat: 'metal', pos: [1.5, 1.95, 0] });
  parts.push(...deckRail(1.3, 1.3, 2.0, 0.42).map((part) => ({
    ...part,
    pos: [part.pos![0] + 1.5, part.pos![1], part.pos![2]] as [number, number, number],
  })));
  parts.push(...ladder([1.5, 0.18, 0.72], 1.85, 0));
  parts.push(...antenna([1.5, 2.0, 0], 1.4, true));

  // Sample airlock and specimen cases on the pad - a laboratory that never
  // brings anything in from outside is not doing science.
  parts.push({ geo: box(0.5, 0.62, 0.44), mat: 'metal', pos: [1.55, 0.5, -1.5] });
  parts.push({ geo: cylinder(0.15, 0.1, 10), mat: 'window', pos: [1.55, 0.72, -1.29], rot: [Math.PI / 2, 0, 0] });
  parts.push(...crates([0.5, 0.18, 1.5], 5150, 3));

  // Analysis console at the airlock end.
  parts.push(...controlPanel([-1.9, 1.1, 1.1], 0.5, 0.8));
  parts.push(...ventGrille([0.55, 1.75, -1.42], 0.5, 0.32));

  parts.push(...airlock([-2.35, 1.05, 0], Math.PI / 2, 1.0, 0.45));

  return parts;
}

export function medicalParts(): Part[] {
  const parts: Part[] = [...foundation(3.7, 3.7)];

  parts.push({ geo: dome(1.65, 24), mat: 'hull', pos: [0, 0.62, 0] });
  parts.push({ geo: cylinder(1.65, 0.55, 24), mat: 'hull', pos: [0, 0.45, 0] });
  parts.push({ geo: torus(1.66, 0.06, 22), mat: 'metal', pos: [0, 0.68, 0], rot: [Math.PI / 2, 0, 0] });

  // Red cross in the corporate accent, raised off the shell.
  parts.push({ geo: box(0.16, 0.05, 0.85), mat: 'hazard', pos: [0, 2.28, 0] });
  parts.push({ geo: box(0.85, 0.05, 0.16), mat: 'hazard', pos: [0, 2.28, 0] });

  parts.push(...viewports(6, [-1.2, 0.95, 1.15], [0.48, 0, 0], 0.16));

  // Medical air and oxygen bottles racked against the shell, plumbed inside.
  for (let i = 0; i < 3; i++) {
    parts.push({ geo: cylinder(0.13, 0.72, 10), mat: 'hull', pos: [-1.45 + i * 0.32, 0.54, -1.15] });
  }
  parts.push(...pipeRun([-1.45, 0.92, -1.15], [-0.8, 0.92, -1.4], 0.04));

  // A decontamination bay outside the airlock: you do not walk Martian dust
  // straight into a clinic.
  parts.push({ geo: box(1.0, 0.05, 0.7), mat: 'concrete', pos: [0, 0.2, 1.95] });
  parts.push(...handrail([-0.5, 0.22, 1.95], [0.5, 0.22, 1.95], 0.4));
  parts.push(...controlPanel([0.78, 0.95, 1.7], -0.5, 0.7));
  parts.push(...ventGrille([1.15, 1.05, 0.9], 0.44, 0.3, -0.8));

  parts.push(...airlock([0, 0.85, 1.95], 0, 1.0, 0.45));
  parts.push(...radiator([1.75, 1.0, -1.0], 1.1, 1.0, -0.9));

  return parts;
}

// ---------------------------------------------------------------------------
// Logistics
// ---------------------------------------------------------------------------

export function spaceportParts(): Part[] {
  const parts: Part[] = [];

  // Blast-hardened circular apron.
  parts.push({ geo: cylinder(3.6, 0.22, 32), mat: 'concrete', pos: [0, 0.11, 0] });
  parts.push({ geo: torus(3.0, 0.09, 32), mat: 'accent', pos: [0, 0.24, 0], rot: [Math.PI / 2, 0, 0] });
  parts.push({ geo: torus(1.5, 0.07, 24), mat: 'accent', pos: [0, 0.24, 0], rot: [Math.PI / 2, 0, 0] });

  // Approach markings.
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    parts.push({
      geo: box(0.9, 0.03, 0.18),
      mat: 'accent',
      pos: [Math.cos(angle) * 2.25, 0.24, Math.sin(angle) * 2.25],
      rot: [0, -angle, 0],
    });
  }

  // Beacon masts around the pad edge.
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + Math.PI / 6;
    parts.push(...antenna([Math.cos(angle) * 3.3, 0.22, Math.sin(angle) * 3.3], 0.85, false));
  }

  // Propellant gantry: methane made from Martian CO2 and water.
  parts.push(...tank([-3.0, 0.2, 2.6], 0.7, 2.1, 'hull'));
  parts.push({ geo: box(0.35, 2.6, 0.35), mat: 'metal', pos: [-1.95, 1.3, 2.6] });
  parts.push({ geo: box(1.5, 0.16, 0.3), mat: 'metal', pos: [-2.6, 2.5, 2.6] });
  parts.push({ geo: unitSphere(), mat: 'hazard', pos: [-1.95, 2.7, 2.6], scale: 0.12 });

  // Cargo handling apron.
  parts.push({ geo: box(1.6, 0.9, 1.2), mat: 'hull', pos: [2.9, 0.65, -2.4] });
  parts.push(...accentBand([2.9, 1.15, -2.4], 0.7));

  return parts;
}

export function batteryParts(): Part[] {
  const parts: Part[] = [...foundation(3.7, 3.7)];

  // Racks of cells behind a service walkway.
  for (let row = 0; row < 2; row++) {
    const z = row === 0 ? -0.85 : 0.85;
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 1.05;
      parts.push({ geo: box(0.88, 1.25, 0.62), mat: 'hull', pos: [x, 0.81, z] });
      parts.push({ geo: box(0.7, 0.09, 0.05), mat: 'accent', pos: [x, 1.28, z + 0.33] });
      // Charge-state indicator.
      parts.push({ geo: unitSphere(), mat: 'window', pos: [x, 1.05, z + 0.33], scale: 0.08 });
    }
  }

  // Service walkway between the rack rows, railed on both sides.
  parts.push({ geo: box(3.2, 0.08, 0.5), mat: 'metal', pos: [0, 0.22, 0] });
  parts.push(...handrail([-1.6, 0.26, -0.26], [1.6, 0.26, -0.26], 0.4));
  parts.push(...handrail([-1.6, 0.26, 0.26], [1.6, 0.26, 0.26], 0.4));

  for (const z of [-0.85, 0.85]) {
    // Busbar trunking over the racks, dropping into each cabinet.
    parts.push({ geo: box(3.1, 0.12, 0.14), mat: 'dark', pos: [0, 1.54, z] });
    // Cooling louvres on every cabinet face - cells that cannot shed heat die.
    for (let i = 0; i < 3; i++) {
      parts.push(
        ...ventGrille([(i - 1) * 1.05, 0.62, z + (z < 0 ? -0.32 : 0.32)], 0.6, 0.34),
      );
    }
  }

  parts.push({ geo: cylinder(0.14, 1.1, 8), mat: 'metal', pos: [1.55, 0.73, 0] });
  parts.push(...controlPanel([-1.62, 1.0, 0], -Math.PI / 2, 0.75));
  parts.push({ geo: unitSphere(), mat: 'hazard', pos: [1.55, 1.35, 0], scale: 0.1 });
  return parts;
}

export function commsParts(): Part[] {
  const parts: Part[] = [...foundation(3.7, 3.7)];

  // Equipment shelter.
  parts.push({ geo: box(1.4, 1.0, 1.2), mat: 'hull', pos: [-0.9, 0.7, 0.7] });
  parts.push(...accentBand([-0.9, 1.15, 0.7], 0.75));

  // Steerable high-gain dish on a mount.
  parts.push({ geo: cylinder(0.18, 1.9, 10), mat: 'metal', pos: [0.6, 1.15, -0.3] });
  parts.push({ geo: cylinder(0.34, 0.4, 12), mat: 'dark', pos: [0.6, 2.15, -0.3] });
  parts.push({
    geo: new THREE.SphereGeometry(1.25, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2.5),
    mat: 'hull',
    pos: [0.6, 2.55, -0.3],
    rot: [Math.PI * 0.68, 0, 0.45],
  });
  // Feed horn at the dish focus.
  parts.push({ geo: unitCone(), mat: 'metal', pos: [0.95, 3.1, 0.35], rot: [-0.6, 0, 0.4], scale: [0.14, 0.4, 0.14] });

  // Rim ribs on the reflector. A smooth bowl reads as moulded plastic; a
  // ribbed one reads as something fabricated in panels and bolted together.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    parts.push({
      geo: box(0.05, 0.05, 1.15),
      mat: 'metal',
      pos: [0.6 + Math.cos(a) * 0.5, 2.72, -0.3 + Math.sin(a) * 0.5],
      rot: [Math.PI * 0.68 + 0.35, a, 0.45],
    });
  }

  // Elevation drive and counterweight on the mount.
  parts.push({ geo: box(0.3, 0.3, 0.42), mat: 'dark', pos: [0.22, 2.15, -0.3] });
  parts.push({ geo: cylinder(0.16, 0.28, 10), mat: 'metal', pos: [0.6, 1.95, -0.72], rot: [Math.PI / 2, 0, 0] });

  // Waveguide from the shelter to the feed, plus the shelter hardware.
  parts.push(...pipeRun([-0.9, 1.2, 0.7], [0.52, 1.9, -0.2], 0.05));
  parts.push(...ventGrille([-0.9, 0.75, 1.31], 0.6, 0.36));
  parts.push(...controlPanel([-0.15, 0.95, 0.7], Math.PI / 2, 0.7));
  parts.push(...boltRow([-1.6, 1.21, 0.7], [-0.2, 1.21, 0.7], 5, 0.018));
  parts.push(...crates([-1.45, 0.18, 1.5], 606, 2));

  parts.push(...antenna([-1.5, 0.2, -1.3], 2.6, false));
  return parts;
}

export function atriumParts(): Part[] {
  const parts: Part[] = [...foundation(5.4, 5.4)];

  // A large glazed dome - the one place colonists see open sky without a suit.
  parts.push({ geo: taperedCylinder(2.45, 2.7, 0.5, 24), mat: 'concrete', pos: [0, 0.42, 0] });
  parts.push({ geo: pressureDome(2.35, 30), mat: 'glass', pos: [0, 0.65, 0] });

  // Geodesic ribbing.
  for (let i = 0; i < 6; i++) {
    parts.push({
      geo: torus(2.36, 0.05, 26),
      mat: 'metal',
      pos: [0, 0.65, 0],
      rot: [0, (i / 6) * Math.PI, Math.PI / 2],
    });
  }
  parts.push({ geo: torus(2.36, 0.06, 28), mat: 'metal', pos: [0, 1.75, 0], rot: [Math.PI / 2, 0, 0] });

  // Planting and lighting inside.
  parts.push({ geo: cylinder(1.5, 0.3, 20), mat: 'soil', pos: [0, 0.62, 0] });
  parts.push({ geo: cylinder(0.35, 0.9, 12), mat: 'soil', pos: [0, 1.1, 0] });
  parts.push({ geo: unitSphere(), mat: 'window', pos: [0, 2.2, 0], scale: 0.3 });

  // A raised service ring and a few support struts make the atrium read as a
  // cared-for civic space rather than a decorative dome on a pad.
  parts.push({ geo: cylinder(0.28, 0.9, 14), mat: 'metal', pos: [0, 1.0, 0], rot: [Math.PI / 2, 0, 0] });
  parts.push({ geo: box(0.16, 2.15, 0.16), mat: 'metal', pos: [1.1, 1.35, 0] });
  parts.push({ geo: box(0.16, 2.15, 0.16), mat: 'metal', pos: [-1.1, 1.35, 0] });
  parts.push({ geo: box(0.16, 2.15, 0.16), mat: 'metal', pos: [0, 1.35, 1.1] });
  parts.push({ geo: box(0.16, 2.15, 0.16), mat: 'metal', pos: [0, 1.35, -1.1] });

  parts.push(...airlock([0, 0.85, 2.65], 0, 1.2, 0.48));
  return parts;
}

export function fuelPlantParts(): Part[] {
  const parts: Part[] = [...foundation(5.6, 3.6)];

  // Sabatier reactor vessel: CO2 plus hydrogen makes methane and water.
  parts.push({ geo: cylinder(0.7, 2.4, 18), mat: 'metal', pos: [-1.4, 1.4, 0] });
  parts.push({ geo: dome(0.7, 18), mat: 'metal', pos: [-1.4, 2.6, 0] });
  parts.push(...accentBand([-1.4, 1.0, 0], 0.74));

  // Cryogenic methane storage.
  parts.push(...tank([0.85, 0.18, -0.85], 0.6, 1.7, 'hull'));
  parts.push(...tank([0.85, 0.18, 0.9], 0.6, 1.7, 'hull'));

  // Condenser and process piping.
  parts.push({ geo: box(1.1, 0.9, 2.4), mat: 'hull', pos: [2.2, 0.65, 0] });
  parts.push({ geo: cylinder(0.11, 2.2, 8), mat: 'metal', pos: [-0.3, 1.9, 0], rot: [0, 0, Math.PI / 2] });
  parts.push({ geo: cylinder(0.09, 1.8, 8), mat: 'metal', pos: [0.85, 0.55, 0], rot: [Math.PI / 2, 0, 0] });

  // Insulation banding up the reactor vessel, and a way onto the top of it.
  for (let i = 0; i < 4; i++) {
    parts.push({
      geo: torus(0.72, 0.045, 18),
      mat: 'metal',
      pos: [-1.4, 0.55 + i * 0.55, 0],
      rot: [Math.PI / 2, 0, 0],
    });
  }
  parts.push(...ladder([-1.4, 0.18, 0.74], 2.5, 0));
  parts.push({ geo: box(1.0, 0.07, 1.0), mat: 'metal', pos: [-1.4, 2.72, 0] });

  // Relief valves and frost collars on the cryogenic tanks: methane is stored
  // cold, and every piece of hardware on the outside should say so.
  for (const z of [-0.85, 0.9]) {
    parts.push({ geo: cylinder(0.07, 0.3, 8), mat: 'metal', pos: [0.85, 2.0, z] });
    parts.push({ geo: torus(0.62, 0.05, 16), mat: 'hull', pos: [0.85, 1.5, z], rot: [Math.PI / 2, 0, 0] });
  }

  // Process plumbing between vessel, condenser and tanks.
  parts.push(...pipeRun([-0.7, 1.9, 0], [0.85, 1.9, -0.85], 0.075));
  parts.push(...pipeRun([-0.7, 1.6, 0], [0.85, 1.6, 0.9], 0.075));
  parts.push(...ventGrille([2.2, 0.95, 1.21], 0.7, 0.4));
  parts.push(...controlPanel([1.6, 1.15, 1.3], 0.4, 0.85));

  parts.push(...radiator([-2.6, 1.2, 0], 1.3, 1.2, Math.PI / 2));
  parts.push({ geo: unitSphere(), mat: 'hazard', pos: [-1.4, 2.85, 0], scale: 0.11 });
  return parts;
}

// ---------------------------------------------------------------------------
// Fallback marker, drawn if a catalog entry ever loses its model.
// ---------------------------------------------------------------------------

export function placeholderParts(): Part[] {
  return [
    { geo: box(1.4, 1.4, 1.4), mat: 'accent', pos: [0, 0.7, 0] },
    { geo: box(1.6, 0.1, 1.6), mat: 'metal', pos: [0, 0.05, 0] },
  ];
}


// ---------------------------------------------------------------------------
// Export Terminal - where the colony turns goods into credits.
// ---------------------------------------------------------------------------

/**
 * The Export Terminal.
 *
 * A blast cradle, a cargo canister sitting in it, and the handling gear that
 * loads one. The read has to be immediate: this is the building that ships
 * things off Mars, so the silhouette is a rocket-shaped canister standing on a
 * pad, and everything else is the machinery that fills it.
 */
export function exportPadParts(): Part[] {
  const parts: Part[] = [...foundation(5.6, 3.6)];

  // --- Blast pad and cradle ----------------------------------------------
  parts.push({ geo: cylinder(1.5, 0.22, 16), mat: 'concrete', pos: [-1.3, 0.24, 0] });
  parts.push({ geo: torus(1.5, 0.08, 18), mat: 'hazard', pos: [-1.3, 0.34, 0], rot: [Math.PI / 2, 0, 0] });

  // Four cradle arms holding the canister off the deck.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    parts.push({
      geo: box(0.16, 0.9, 0.16),
      mat: 'metal',
      pos: [-1.3 + Math.cos(a) * 1.05, 0.7, Math.sin(a) * 1.05],
      rot: [Math.sin(a) * 0.16, 0, -Math.cos(a) * 0.16],
    });
  }

  // --- The cargo canister -------------------------------------------------
  parts.push({ geo: cylinder(0.78, 2.5, 18), mat: 'hull', pos: [-1.3, 2.2, 0] });
  parts.push({ geo: unitCone(), mat: 'hull', pos: [-1.3, 3.9, 0], scale: [0.78, 1.0, 0.78] });
  parts.push({ geo: torus(0.8, 0.055, 18), mat: 'metal', pos: [-1.3, 1.4, 0], rot: [Math.PI / 2, 0, 0] });
  parts.push({ geo: torus(0.8, 0.055, 18), mat: 'metal', pos: [-1.3, 2.9, 0], rot: [Math.PI / 2, 0, 0] });
  parts.push(...accentBand([-1.3, 2.15, 0], 0.82));

  // Engine bell under the canister, and its hold-down clamps.
  parts.push({ geo: unitCone(), mat: 'dark', pos: [-1.3, 0.75, 0], rot: [Math.PI, 0, 0], scale: [0.34, 0.5, 0.34] });

  // --- Cargo handling -----------------------------------------------------
  // Gantry mast with a loading arm reaching to the canister hatch.
  parts.push({ geo: box(0.24, 3.4, 0.24), mat: 'metal', pos: [0.4, 1.9, -1.0] });
  parts.push({ geo: box(1.5, 0.16, 0.2), mat: 'metal', pos: [-0.35, 3.1, -1.0] });
  parts.push(...pipeRun([0.4, 2.6, -1.0], [-0.55, 2.6, -0.35], 0.06));
  parts.push(...ladder([0.4, 0.18, -0.82], 3.3, 0));

  // Containerised cargo waiting to be loaded, on a marked-out yard.
  parts.push({ geo: box(2.2, 0.05, 2.4), mat: 'concrete', pos: [1.6, 0.2, 0.2] });
  for (let i = 0; i < 3; i++) {
    parts.push({
      geo: box(1.0, 0.5, 0.56),
      mat: i === 1 ? 'metal' : 'hull',
      pos: [1.5 + (i % 2) * 0.12, 0.47 + Math.floor(i / 2) * 0.5, -0.5 + (i % 3) * 0.62],
    });
  }

  // Handling crane over the yard.
  parts.push({ geo: box(0.14, 1.7, 0.14), mat: 'metal', pos: [2.5, 1.05, -0.8] });
  parts.push({ geo: box(0.14, 1.7, 0.14), mat: 'metal', pos: [2.5, 1.05, 1.2] });
  parts.push({ geo: box(0.16, 0.16, 2.2), mat: 'metal', pos: [2.5, 1.9, 0.2] });
  parts.push({ geo: cylinder(0.02, 0.7, 5), mat: 'metal', pos: [2.5, 1.5, 0.2] });
  parts.push({ geo: box(0.3, 0.2, 0.3), mat: 'dark', pos: [2.5, 1.12, 0.2] });

  // --- Operations ---------------------------------------------------------
  // The manifest desk: this is a shipping office as much as a launch pad.
  parts.push({ geo: box(1.0, 0.85, 0.8), mat: 'hull', pos: [0.5, 0.6, 1.35] });
  parts.push(...ventGrille([0.5, 0.55, 1.76], 0.5, 0.3));
  parts.push(...controlPanel([0.5, 1.12, 1.3], 0, 0.85));
  parts.push(...handrail([-0.2, 0.2, 1.75], [1.2, 0.2, 1.75], 0.42));

  parts.push({ geo: unitSphere(), mat: 'hazard', pos: [0.4, 3.68, -1.0], scale: 0.1 });
  return parts;
}
