/**
 * The detail kit.
 *
 * The greebles that separate "a shape" from "a machine". Everything here is
 * merged into a building's geometry like any other part, so a structure can
 * carry a hundred extra pieces of hardware for zero extra draw calls — the cost
 * is triangles, which at this camera distance is the cheap resource.
 *
 * The rule for what belongs here: it has to be something a real installation
 * would actually need. Handrails exist because people walk there, ladders
 * because somebody services the top, control panels because a machine nobody
 * can operate is a prop. Detail that answers "why is that there" reads as
 * engineering. Detail that does not reads as noise, and more noise is not more
 * realism.
 */

import { Random } from '../core/rng';
import { box, cylinder, unitSphere, type Part } from './model';
import type { MaterialKey } from './materials';

/**
 * A wall-mounted control panel: housing, screen, and rows of buttons.
 *
 * The buttons are what sell it. At this distance each is two or three pixels,
 * but they catch light differently from the housing and the eye reads
 * "operable machine" without ever resolving a single one.
 */
export function controlPanel(
  position: [number, number, number],
  rotationY = 0,
  scale = 1,
): Part[] {
  const parts: Part[] = [];
  const w = 0.44 * scale;
  const h = 0.34 * scale;
  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);

  // Housing, tilted back slightly as a real console is.
  parts.push({
    geo: box(w, h, 0.07 * scale),
    mat: 'dark',
    pos: position,
    rot: [-0.18, rotationY, 0],
  });

  // Lit screen, inset.
  parts.push({
    geo: box(w * 0.72, h * 0.4, 0.03),
    mat: 'window',
    pos: [position[0], position[1] + h * 0.18, position[2]],
    rot: [-0.18, rotationY, 0],
  });

  // Two rows of keys beneath it, one of them an emergency stop.
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 4; i++) {
      const offset = (i - 1.5) * 0.078 * scale;
      parts.push({
        geo: box(0.046 * scale, 0.03 * scale, 0.03),
        mat: row === 0 && i === 3 ? 'hazard' : 'accent',
        pos: [
          position[0] + offset * cos,
          position[1] - h * 0.1 - row * 0.08 * scale,
          position[2] - offset * sin,
        ],
        rot: [-0.18, rotationY, 0],
      });
    }
  }

  return parts;
}

/**
 * A run of handrail: posts, a top rail and a mid rail.
 *
 * More than anything else in this kit, handrails give a structure human scale —
 * they are the one piece of hardware whose real dimensions the viewer already
 * knows, so everything around them inherits a size.
 */
export function handrail(
  from: [number, number, number],
  to: [number, number, number],
  height = 0.52,
): Part[] {
  const parts: Part[] = [];
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const length = Math.hypot(dx, dz);
  if (length < 0.01) return parts;

  const angle = Math.atan2(dx, dz);
  const midX = (from[0] + to[0]) / 2;
  const midZ = (from[2] + to[2]) / 2;

  for (const railY of [height, height * 0.55]) {
    parts.push({
      geo: cylinder(0.022, length, 6),
      mat: 'metal',
      pos: [midX, from[1] + railY, midZ],
      rot: [Math.PI / 2, 0, angle],
    });
  }

  const posts = Math.max(2, Math.round(length / 0.9));
  for (let i = 0; i <= posts; i++) {
    const t = i / posts;
    parts.push({
      geo: cylinder(0.026, height, 6),
      mat: 'metal',
      pos: [from[0] + dx * t, from[1] + height / 2, from[2] + dz * t],
    });
  }

  return parts;
}

/** Handrail around all four sides of a rectangular deck. */
export function deckRail(
  width: number,
  depth: number,
  y: number,
  height = 0.52,
): Part[] {
  const hw = width / 2;
  const hd = depth / 2;
  return [
    ...handrail([-hw, y, -hd], [hw, y, -hd], height),
    ...handrail([-hw, y, hd], [hw, y, hd], height),
    ...handrail([-hw, y, -hd], [-hw, y, hd], height),
    ...handrail([hw, y, -hd], [hw, y, hd], height),
  ];
}

/** A service ladder: two stiles and rungs. Somebody has to get up there. */
export function ladder(
  position: [number, number, number],
  height: number,
  rotationY = 0,
): Part[] {
  const parts: Part[] = [];
  const width = 0.34;
  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);

  for (const side of [-1, 1]) {
    parts.push({
      geo: cylinder(0.026, height, 6),
      mat: 'metal',
      pos: [
        position[0] + side * (width / 2) * cos,
        position[1] + height / 2,
        position[2] - side * (width / 2) * sin,
      ],
    });
  }

  const rungs = Math.max(2, Math.floor(height / 0.3));
  for (let i = 1; i < rungs; i++) {
    parts.push({
      geo: cylinder(0.017, width, 5),
      mat: 'metal',
      pos: [position[0], position[1] + (i / rungs) * height, position[2]],
      rot: [0, rotationY, Math.PI / 2],
    });
  }

  return parts;
}

/**
 * A pipe run with flanged ends.
 *
 * A straight pipe reads as a cylinder; a pipe with flanges reads as plumbing
 * that connects two things.
 */
export function pipeRun(
  from: [number, number, number],
  to: [number, number, number],
  radius = 0.075,
  material: MaterialKey = 'metal',
): Part[] {
  const parts: Part[] = [];
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  const length = Math.hypot(dx, dy, dz);
  if (length < 0.02) return parts;

  // Orient a Y-axis cylinder onto the segment.
  const yaw = Math.atan2(dx, dz);
  const pitch = Math.acos(Math.max(-1, Math.min(1, dy / length)));

  parts.push({
    geo: cylinder(radius, length, 10),
    mat: material,
    pos: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2],
    rot: [pitch, yaw, 0],
  });

  for (const end of [from, to]) {
    parts.push({
      geo: cylinder(radius * 1.5, radius * 0.55, 10),
      mat: 'metal',
      pos: end,
      rot: [pitch, yaw, 0],
    });
  }

  return parts;
}

/** A louvred vent panel. Heat has to go somewhere. */
export function ventGrille(
  position: [number, number, number],
  width = 0.6,
  height = 0.4,
  rotationY = 0,
): Part[] {
  const parts: Part[] = [
    { geo: box(width, height, 0.05), mat: 'dark', pos: position, rot: [0, rotationY, 0] },
  ];

  const louvres = Math.max(3, Math.round(height / 0.09));
  for (let i = 0; i < louvres; i++) {
    parts.push({
      geo: box(width * 0.86, 0.022, 0.06),
      mat: 'metal',
      pos: [
        position[0],
        position[1] - height / 2 + ((i + 0.5) / louvres) * height,
        position[2],
      ],
      rot: [0.42, rotationY, 0],
    });
  }

  return parts;
}

/** Stacked supply crates. Colonies arrive with cargo and never fully unpack. */
export function crates(position: [number, number, number], seed = 1, count = 3): Part[] {
  const parts: Part[] = [];
  const rand = new Random(seed);

  for (let i = 0; i < count; i++) {
    const size = rand.range(0.32, 0.48);
    const x = position[0] + rand.range(-0.45, 0.45);
    const z = position[2] + rand.range(-0.45, 0.45);
    const stack = rand.int(1, 2);

    for (let level = 0; level < stack; level++) {
      parts.push({
        geo: box(size, size * 0.72, size),
        mat: level % 2 === 0 ? 'hull' : 'metal',
        pos: [x, position[1] + size * 0.36 + level * size * 0.72, z],
        rot: [0, rand.range(-0.4, 0.4), 0],
      });
    }
  }

  return parts;
}

/** A row of rivets or bolts along an edge — surface grain at almost no cost. */
export function boltRow(
  from: [number, number, number],
  to: [number, number, number],
  count = 8,
  radius = 0.022,
): Part[] {
  const parts: Part[] = [];
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    parts.push({
      geo: cylinder(radius, radius * 0.7, 6),
      mat: 'metal',
      pos: [
        from[0] + (to[0] - from[0]) * t,
        from[1] + (to[1] - from[1]) * t,
        from[2] + (to[2] - from[2]) * t,
      ],
      rot: [Math.PI / 2, 0, 0],
    });
  }
  return parts;
}

/**
 * Crops growing in a bed.
 *
 * The old greenhouse laid a green box on top of the soil and called it
 * planting, which is why it read as a slab of paint. Real planting is *many
 * separate things at slightly different heights*, and that irregularity is the
 * entire visual signature of a growing crop. It is also cheap: each plant is a
 * handful of triangles and they all merge into the one geometry.
 *
 * Two crop forms, because a greenhouse growing a single thing looks like a
 * factory: low leafy heads (lettuce, chard) and tall stalks (wheat, beans).
 */
export function crops(
  centre: [number, number, number],
  length: number,
  width: number,
  seed = 7,
  density = 1,
): Part[] {
  const parts: Part[] = [];
  const rand = new Random(seed);

  const columns = Math.max(3, Math.round((length / 0.44) * density));
  const rows = Math.max(1, Math.round(width / 0.36));

  for (let c = 0; c < columns; c++) {
    for (let r = 0; r < rows; r++) {
      // Jittered off the grid: plants in a bed are never in perfect ranks, and
      // perfect ranks are what made the old version look manufactured.
      const x =
        centre[0] - length / 2 + ((c + 0.5) / columns) * length + rand.range(-0.05, 0.05);
      const z = centre[2] - width / 2 + ((r + 0.5) / rows) * width + rand.range(-0.04, 0.04);
      const y = centre[1];

      if (rand.bool(0.62)) {
        // --- Leafy head: a rosette of blades around a short core ---------
        const scale = rand.range(0.75, 1.25);
        const leaves = rand.int(5, 7);

        parts.push({
          geo: unitSphere(),
          mat: 'foliageDeep',
          pos: [x, y + 0.05 * scale, z],
          scale: [0.07 * scale, 0.05 * scale, 0.07 * scale],
        });

        for (let l = 0; l < leaves; l++) {
          const angle = (l / leaves) * Math.PI * 2 + rand.range(-0.3, 0.3);
          const tilt = rand.range(0.55, 1.05);
          const reach = rand.range(0.07, 0.12) * scale;
          parts.push({
            geo: box(0.014, 0.155 * scale, 0.08 * scale),
            mat: l % 3 === 0 ? 'foliageDeep' : 'foliage',
            pos: [x + Math.cos(angle) * reach, y + 0.07 * scale, z + Math.sin(angle) * reach],
            rot: [tilt * Math.sin(angle), -angle, tilt * Math.cos(angle)],
          });
        }
      } else {
        // --- Tall stalk: a stem with blades stepping up it ---------------
        const height = rand.range(0.32, 0.54);
        parts.push({
          geo: cylinder(0.011, height, 5),
          mat: 'foliageDeep',
          pos: [x, y + height / 2, z],
          rot: [rand.range(-0.07, 0.07), 0, rand.range(-0.07, 0.07)],
        });

        const blades = rand.int(3, 5);
        for (let b = 0; b < blades; b++) {
          const t = 0.3 + (b / blades) * 0.64;
          const angle = b * 2.4 + rand.range(-0.4, 0.4);
          parts.push({
            geo: box(0.011, 0.125, 0.048),
            mat: 'foliage',
            pos: [x + Math.cos(angle) * 0.042, y + height * t, z + Math.sin(angle) * 0.042],
            rot: [0.9 * Math.sin(angle), -angle, 0.9 * Math.cos(angle)],
          });
        }

        // A seed head on the tallest stalks.
        if (height > 0.46) {
          parts.push({
            geo: unitSphere(),
            mat: 'foliage',
            pos: [x, y + height + 0.028, z],
            scale: [0.026, 0.052, 0.026],
          });
        }
      }
    }
  }

  return parts;
}
