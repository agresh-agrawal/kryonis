'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { currentMoons, currentSun } from './sun';

/**
 * Must stay comfortably inside the camera's far plane.
 *
 * `depthTest: false` stops the dome fighting the scene for depth, but it does
 * not exempt it from frustum clipping - if the sphere's surface sits at or
 * beyond `far`, the whole sky is clipped away and the screen renders black.
 */
const SKY_RADIUS = 3000;

const vertexShader = /* glsl */ `
  varying vec3 vDirection;

  void main() {
    // Direction from the camera to this point on the sky dome, in world space.
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vDirection = normalize(worldPosition.xyz - cameraPosition);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uHorizonColor;
  uniform vec3 uZenithColor;
  uniform vec3 uGlowColor;
  uniform vec3 uSunDirection;
  uniform vec3 uPhobosDirection;
  uniform vec3 uDeimosDirection;
  uniform float uPhobosBrightness;
  uniform float uDeimosBrightness;
  uniform float uNightFactor;
  uniform float uDustOpacity;

  varying vec3 vDirection;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  // Value noise on a 3D lattice, used to give the galactic band structure.
  float valueNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float n000 = hash(i);
    float n100 = hash(i + vec3(1.0, 0.0, 0.0));
    float n010 = hash(i + vec3(0.0, 1.0, 0.0));
    float n110 = hash(i + vec3(1.0, 1.0, 0.0));
    float n001 = hash(i + vec3(0.0, 0.0, 1.0));
    float n101 = hash(i + vec3(1.0, 0.0, 1.0));
    float n011 = hash(i + vec3(0.0, 1.0, 1.0));
    float n111 = hash(i + vec3(1.0, 1.0, 1.0));

    return mix(
      mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
      mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
      f.z
    );
  }

  float fbm(vec3 p) {
    float sum = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
      sum += amplitude * valueNoise(p);
      p *= 2.02;
      amplitude *= 0.5;
    }
    return sum;
  }

  // One star layer: sparse bright points on a lattice of the given density.
  vec3 starLayer(vec3 dir, float density, float threshold, float intensity) {
    vec3 cell = floor(dir * density);
    float h = hash(cell);
    if (h < threshold) return vec3(0.0);

    // Position the star within its cell so the field is not visibly gridded.
    vec3 offset = vec3(hash(cell + 1.3), hash(cell + 2.7), hash(cell + 4.1)) - 0.5;
    vec3 starDir = normalize((cell + 0.5 + offset * 0.8) / density);

    float d = 1.0 - dot(dir, starDir);
    float point = exp(-d * density * density * 0.4);

    // Cooler and warmer stars, so the field is not uniformly white.
    float temperature = hash(cell + 8.9);
    vec3 tint = mix(vec3(0.75, 0.83, 1.0), vec3(1.0, 0.88, 0.72), temperature);

    return tint * point * intensity * (0.4 + h * 0.6);
  }

  // A moon: a small lit disc with a soft halo.
  vec3 moon(vec3 dir, vec3 moonDir, float size, float brightness, vec3 tint) {
    if (brightness <= 0.001) return vec3(0.0);
    float cosAngle = dot(dir, moonDir);
    float disc = smoothstep(1.0 - size, 1.0 - size * 0.45, cosAngle);
    float halo = pow(max(cosAngle, 0.0), 900.0) * 0.5;
    return tint * (disc + halo) * brightness;
  }

  void main() {
    vec3 dir = normalize(vDirection);

    // Vertical gradient. The exponent keeps the butterscotch band low and
    // wide, the way a dusty atmosphere actually looks.
    float h = clamp(dir.y, 0.0, 1.0);
    vec3 color = mix(uHorizonColor, uZenithColor, pow(h, 0.55));

    // Solar disc and its surrounding scatter.
    float cosAngle = dot(dir, uSunDirection);
    float discMask = smoothstep(0.99965, 0.99992, cosAngle);
    float tightGlow = pow(max(cosAngle, 0.0), 220.0);
    float wideGlow = pow(max(cosAngle, 0.0), 8.0);
    float hazeGlow = pow(max(cosAngle, 0.0), 2.0);

    color += uGlowColor * (tightGlow * 0.9 + wideGlow * 0.35 + hazeGlow * 0.12);
    color = mix(color, uGlowColor * 1.6, discMask);

    if (uNightFactor > 0.01) {
      float aboveHorizon = smoothstep(-0.02, 0.18, dir.y);
      float night = uNightFactor * aboveHorizon;

      // The galactic band. Mars has no light pollution and a thin atmosphere,
      // so the Milky Way is genuinely spectacular from the surface.
      vec3 galacticPole = normalize(vec3(0.33, 0.62, -0.71));
      float bandDistance = abs(dot(dir, galacticPole));
      float band = exp(-bandDistance * bandDistance * 22.0);
      float structure = fbm(dir * 7.0) * 0.7 + fbm(dir * 19.0) * 0.45;
      vec3 galaxyTint = mix(vec3(0.42, 0.47, 0.72), vec3(0.78, 0.71, 0.62), structure * 0.6);
      color += galaxyTint * band * structure * 0.5 * night;

      // Two star layers: sparse bright ones, dense faint ones.
      color += starLayer(dir, 42.0, 0.9955, 2.6) * night;
      color += starLayer(dir, 96.0, 0.9988, 1.7) * night;

      // Moons.
      color += moon(dir, uPhobosDirection, 0.00055, uPhobosBrightness, vec3(1.0, 0.94, 0.86));
      color += moon(dir, uDeimosDirection, 0.00022, uDeimosBrightness, vec3(0.92, 0.9, 0.86));
    }

    // Suspended dust washes everything toward the horizon colour near the
    // ground - the permanent haze that makes distance readable on Mars.
    float groundHaze = smoothstep(0.3, -0.05, dir.y);
    color = mix(color, uHorizonColor * 0.92, groundHaze * uDustOpacity);

    // Left in linear space on purpose: tone mapping and the sRGB transfer are
    // applied once, for the whole frame, by the post-processing chain.
    gl_FragColor = vec4(color, 1.0);
  }
`;

/**
 * The sky dome and atmospheric fog.
 *
 * Drawn as an inverted sphere with a hand-written gradient rather than one of
 * three.js's built-in sky models, all of which assume Earth's Rayleigh
 * scattering and come out blue.
 */
export function MarsSky({ dustOpacity = 1 }: { dustOpacity?: number }) {
  const scene = useThree((state) => state.scene);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const fogColor = useMemo(() => new THREE.Color(), []);

  const uniforms = useMemo(
    () => ({
      uHorizonColor: { value: new THREE.Color() },
      uZenithColor: { value: new THREE.Color() },
      uGlowColor: { value: new THREE.Color() },
      uSunDirection: { value: new THREE.Vector3() },
      uPhobosDirection: { value: new THREE.Vector3() },
      uDeimosDirection: { value: new THREE.Vector3() },
      uPhobosBrightness: { value: 0 },
      uDeimosBrightness: { value: 0 },
      uNightFactor: { value: 0 },
      uDustOpacity: { value: dustOpacity },
    }),
    // Uniform objects are mutated in place below; recreate only on mount.
    [],
  );

  useEffect(() => {
    scene.fog = new THREE.FogExp2(0x000000, 0.0022);
    return () => {
      scene.fog = null;
    };
  }, [scene]);

  // Push the live sun and moons into the shader, and keep scene fog in step so
  // distant terrain always dissolves into whatever colour the horizon is.
  useFrame(() => {
    uniforms.uHorizonColor.value.copy(currentSun.horizonColor);
    uniforms.uZenithColor.value.copy(currentSun.zenithColor);
    uniforms.uGlowColor.value.copy(currentSun.glowColor);
    uniforms.uSunDirection.value.copy(currentSun.direction);
    uniforms.uNightFactor.value = currentSun.nightFactor;
    uniforms.uDustOpacity.value = dustOpacity;

    uniforms.uPhobosDirection.value.copy(currentMoons.phobos.direction);
    uniforms.uDeimosDirection.value.copy(currentMoons.deimos.direction);
    uniforms.uPhobosBrightness.value = currentMoons.phobos.brightness;
    uniforms.uDeimosBrightness.value = currentMoons.deimos.brightness;

    if (scene.fog) {
      fogColor.copy(currentSun.horizonColor).lerp(currentSun.zenithColor, 0.25);
      (scene.fog as THREE.FogExp2).color.copy(fogColor);
      // Daytime dust is thick and hazy; night air reads clearer and colder.
      (scene.fog as THREE.FogExp2).density = 0.0016 + (1 - currentSun.nightFactor) * 0.0018;
    }
  });

  return (
    <mesh frustumCulled={false} renderOrder={-1000} name="sky">
      <sphereGeometry args={[SKY_RADIUS, 48, 24]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        side={THREE.BackSide}
        depthWrite={false}
        depthTest={false}
        toneMapped={false}
        fog={false}
      />
    </mesh>
  );
}
