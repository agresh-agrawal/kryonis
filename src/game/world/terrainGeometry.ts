/**
 * Radial terrain geometry.
 *
 * The ground is built as a single disc centred on the colony rather than a
 * square plane, for one reason: the world has to reach the horizon. A square
 * tile of terrain reads as a diorama floating in space no matter how good the
 * shading is, and the fix is simply to keep generating ground until fog hides
 * it.
 *
 * Sampling density is distributed in bands - fine across the crater floor and
 * its wall, progressively coarser out to the far mountains - so the vertex
 * budget is spent where the player actually is. Because it is one continuous
 * mesh there are no LOD seams to hide.
 */

import * as THREE from 'three';

/** One annulus of the terrain disc. */
export interface TerrainBand {
  /** Outer radius of this band, in world units. */
  radius: number;
  /** Number of concentric rings of vertices used to reach it. */
  rings: number;
}

export interface RadialTerrainOptions {
  bands: TerrainBand[];
  /** Vertices around the full circle. Constant across all bands. */
  thetaSegments: number;
  /** World size that one repeat of the UV space covers. */
  uvScale: number;
}

/**
 * Builds the base disc: positions on a flat plane, ready to be displaced.
 *
 * Vertices are laid out ring by ring outward from a single centre vertex, and
 * indices wrap around the circle, so the mesh is watertight with no duplicated
 * seam column.
 */
export function createRadialTerrainGeometry({
  bands,
  thetaSegments,
  uvScale,
}: RadialTerrainOptions): THREE.BufferGeometry {
  // Build the full list of ring radii from the band description.
  const radii: number[] = [];
  let previousRadius = 0;
  for (const band of bands) {
    for (let i = 1; i <= band.rings; i++) {
      radii.push(previousRadius + ((band.radius - previousRadius) * i) / band.rings);
    }
    previousRadius = band.radius;
  }

  const ringCount = radii.length;
  const vertexCount = 1 + ringCount * thetaSegments;

  const positions = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);

  // Centre vertex.
  positions[0] = 0;
  positions[1] = 0;
  positions[2] = 0;
  uvs[0] = 0.5;
  uvs[1] = 0.5;

  const angleStep = (Math.PI * 2) / thetaSegments;

  for (let ring = 0; ring < ringCount; ring++) {
    const radius = radii[ring];
    for (let segment = 0; segment < thetaSegments; segment++) {
      const index = 1 + ring * thetaSegments + segment;
      const angle = segment * angleStep;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      positions[index * 3] = x;
      positions[index * 3 + 1] = 0;
      positions[index * 3 + 2] = z;

      // Planar UVs so tiling detail maps stay consistent regardless of the
      // radial vertex layout.
      uvs[index * 2] = x / uvScale + 0.5;
      uvs[index * 2 + 1] = z / uvScale + 0.5;
    }
  }

  // Index buffer: a fan across the innermost ring, then quad strips outward.
  const triangleCount = thetaSegments + (ringCount - 1) * thetaSegments * 2;
  const indices = vertexCount > 65535 ? new Uint32Array(triangleCount * 3) : new Uint16Array(triangleCount * 3);

  let cursor = 0;
  for (let segment = 0; segment < thetaSegments; segment++) {
    const a = 1 + segment;
    const b = 1 + ((segment + 1) % thetaSegments);
    indices[cursor++] = 0;
    indices[cursor++] = b;
    indices[cursor++] = a;
  }

  for (let ring = 0; ring < ringCount - 1; ring++) {
    const inner = 1 + ring * thetaSegments;
    const outer = 1 + (ring + 1) * thetaSegments;
    for (let segment = 0; segment < thetaSegments; segment++) {
      const next = (segment + 1) % thetaSegments;
      const i0 = inner + segment;
      const i1 = inner + next;
      const o0 = outer + segment;
      const o1 = outer + next;

      indices[cursor++] = i0;
      indices[cursor++] = o1;
      indices[cursor++] = o0;

      indices[cursor++] = i0;
      indices[cursor++] = i1;
      indices[cursor++] = o1;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));

  return geometry;
}

/**
 * Band layout per quality tier.
 *
 * The first band always covers the crater floor and wall at high density; the
 * outer bands exist to fill the horizon and can be crude, because atmospheric
 * haze removes most of their detail anyway.
 */
export function terrainBandsFor(subdivisions: number): TerrainBand[] {
  const detail = Math.max(1, subdivisions);
  return [
    // Crater floor and wall - everything the player interacts with.
    { radius: 140, rings: Math.round(30 * detail) },
    // Ejecta apron just beyond the rim.
    { radius: 340, rings: Math.round(7 * detail) },
    // Distant highlands and skyline mountains.
    { radius: 1400, rings: Math.round(4 * detail) },
  ];
}

export function thetaSegmentsFor(subdivisions: number): number {
  return THREE.MathUtils.clamp(Math.round(subdivisions * 84), 160, 640);
}
