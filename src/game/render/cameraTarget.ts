import * as THREE from 'three';

/**
 * The point the RTS camera is orbiting.
 *
 * Kept as a shared mutable vector rather than React state on purpose: it
 * changes every frame while the player pans, and anything that reads it
 * (the shadow camera, dust motes, the minimap) does so inside `useFrame`.
 * Routing it through React would re-render the whole scene 60 times a second.
 */
export const cameraTarget = new THREE.Vector3(0, 0, 0);
