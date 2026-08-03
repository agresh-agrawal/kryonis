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
  accentBand,
  airlock,
  antenna,
  box,
  capsule,
  cylinder,
  dome,
  foundation,
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

  parts.push({ geo: dome(2.4, 28), mat: 'hull', pos: [0, 0.95, 0] });
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
  parts.push({ geo: unitSphere(), mat: 'hazard', pos: [0, 3.85, 0], scale: 0.12 });

  return parts;
}

export function corridorParts(): Part[] {
  return [
    { geo: capsule(0.45, 1.4), mat: 'hull', pos: [0, 0.62, 0] },
    { geo: torus(0.47, 0.05, 14), mat: 'metal', pos: [-0.55, 0.62, 0], rot: [0, Math.PI / 2, 0] },
    { geo: torus(0.47, 0.05, 14), mat: 'metal', pos: [0.55, 0.62, 0], rot: [0, Math.PI / 2, 0] },
    ...viewports(2, [-0.3, 0.75, 0.42], [0.6, 0, 0], 0.11),
    ...foundation(2.2, 1.4, 0.12),
  ];
}

// ---------------------------------------------------------------------------
// Power
// ---------------------------------------------------------------------------

export function solarFarmParts(): Part[] {
  const parts: Part[] = [...foundation(3.7, 3.7, 0.12)];

  // Three tracking rows tilted toward the noon sun.
  for (let row = 0; row < 3; row++) {
    const z = (row - 1) * 1.15;
    parts.push({
      geo: box(3.3, 0.05, 0.95),
      mat: 'solar',
      pos: [0, 0.72, z],
      rot: [-0.52, 0, 0],
    });
    // Panel frame and torque tube.
    parts.push({ geo: box(3.36, 0.04, 1.02), mat: 'metal', pos: [0, 0.7, z], rot: [-0.52, 0, 0] });
    parts.push({ geo: cylinder(0.05, 3.3, 8), mat: 'metal', pos: [0, 0.62, z], rot: [0, 0, Math.PI / 2] });
    for (const x of [-1.3, 1.3]) {
      parts.push({ geo: cylinder(0.07, 0.62, 8), mat: 'metal', pos: [x, 0.31, z] });
    }
  }

  // Inverter / power conditioning cabinet.
  parts.push({ geo: box(0.72, 0.85, 0.5), mat: 'hull', pos: [1.35, 0.55, 1.5] });
  parts.push({ geo: box(0.5, 0.1, 0.04), mat: 'accent', pos: [1.35, 0.82, 1.76] });

  return parts;
}

export function reactorParts(): Part[] {
  const parts: Part[] = [...foundation(3.7, 3.7)];

  // Buried shield plug with the reactor core above it.
  parts.push({ geo: taperedCylinder(0.95, 1.25, 0.8, 16), mat: 'concrete', pos: [0, 0.58, 0] });
  parts.push({ geo: cylinder(0.62, 1.35, 16), mat: 'gold', pos: [0, 1.65, 0] });
  parts.push({ geo: dome(0.62, 16), mat: 'metal', pos: [0, 2.32, 0] });
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

  // Interconnect piping.
  parts.push({ geo: cylinder(0.09, 1.9, 8), mat: 'metal', pos: [-0.05, 0.75, -0.6], rot: [0, 0, Math.PI / 2] });
  parts.push({ geo: cylinder(0.08, 1.5, 8), mat: 'metal', pos: [-0.1, 0.5, 0.3], rot: [Math.PI / 2, 0, 0] });

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

  parts.push({ geo: unitSphere(), mat: 'hazard', pos: [0, 2.7, 0], scale: 0.1 });
  return parts;
}

export function greenhouseParts(): Part[] {
  const parts: Part[] = [...foundation(5.6, 3.6)];

  // Glazed barrel vault.
  parts.push({ geo: vault(1.45, 5.0, 24), mat: 'glass', pos: [0, 0.2, 0] });
  // Structural ribs over the glazing.
  for (let i = 0; i < 6; i++) {
    const x = -2.3 + i * 0.92;
    parts.push({ geo: torus(1.46, 0.055, 20), mat: 'metal', pos: [x, 0.2, 0], rot: [0, Math.PI / 2, 0] });
  }
  // End walls.
  for (const x of [-2.52, 2.52]) {
    parts.push({ geo: cylinder(1.45, 0.08, 20), mat: 'hull', pos: [x, 0.2, 0], rot: [0, 0, Math.PI / 2] });
  }

  // Planting beds and grow lights.
  for (const z of [-0.72, 0, 0.72]) {
    parts.push({ geo: box(4.5, 0.34, 0.5), mat: 'soil', pos: [0, 0.38, z] });
    parts.push({ geo: box(4.5, 0.06, 0.55), mat: 'metal', pos: [0, 0.22, z] });
  }
  parts.push({ geo: box(4.6, 0.07, 0.16), mat: 'window', pos: [0, 1.3, 0] });

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

  // Service gantry linking the tank tops.
  parts.push({ geo: box(2.5, 0.08, 0.3), mat: 'metal', pos: [0, 1.15, -0.85] });
  parts.push({ geo: box(0.3, 0.08, 2.4), mat: 'metal', pos: [-0.85, 1.15, 0] });
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

  // Instrument deck.
  parts.push({ geo: box(1.3, 0.1, 1.3), mat: 'metal', pos: [1.5, 1.95, 0] });
  parts.push(...antenna([1.5, 2.0, 0], 1.4, true));
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

  parts.push({ geo: box(3.2, 0.08, 0.5), mat: 'metal', pos: [0, 0.22, 0] });
  parts.push({ geo: cylinder(0.14, 1.1, 8), mat: 'metal', pos: [1.55, 0.73, 0] });
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

  parts.push(...antenna([-1.5, 0.2, -1.3], 2.6, false));
  return parts;
}

export function atriumParts(): Part[] {
  const parts: Part[] = [...foundation(5.4, 5.4)];

  // A large glazed dome - the one place colonists see open sky without a suit.
  parts.push({ geo: taperedCylinder(2.45, 2.7, 0.5, 24), mat: 'concrete', pos: [0, 0.42, 0] });
  parts.push({ geo: dome(2.35, 30), mat: 'glass', pos: [0, 0.65, 0] });

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
