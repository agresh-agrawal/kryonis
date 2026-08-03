/**
 * Solar model for a Martian sol.
 *
 * One source of truth for where the sun is and what colour its light is, used
 * by the directional light, the sky shader and (later) the output curve of
 * every solar farm in the colony.
 *
 * The colours here are deliberately not Earth's. Mars has a dusty CO2
 * atmosphere that scatters long wavelengths forward, so the daytime sky is
 * butterscotch while the light *near the sun at sunset* turns pale blue - the
 * inverse of Earth. It is one of the most recognisable facts about the planet
 * and it costs nothing to get right.
 */

import * as THREE from 'three';
import { clamp01, lerp, smoothstep } from '../core/noise';

/** Inclination of the sun's arc, so shadows sweep rather than run flat east-west. */
const PATH_TILT = 0.45;

export interface SunState {
  /** Unit vector from the origin toward the sun. */
  direction: THREE.Vector3;
  /** Sun elevation above the horizon, -1 (nadir) to 1 (zenith). */
  elevation: number;
  /** Directional light intensity. */
  intensity: number;
  /** Colour of direct sunlight. */
  color: THREE.Color;
  /** Ambient/hemisphere fill intensity - the sky is never truly black in dust. */
  ambientIntensity: number;
  /** Sky colour at the horizon. */
  horizonColor: THREE.Color;
  /** Sky colour overhead. */
  zenithColor: THREE.Color;
  /** Colour of the glow immediately around the solar disc. */
  glowColor: THREE.Color;
  /** Fraction of peak photovoltaic output available, 0..1. */
  solarFactor: number;
  /** 1 during full night, 0 during full day, smooth across twilight. */
  nightFactor: number;
}

// Daytime palette.
const DAY_SUN = new THREE.Color('#fff0d8');
const DAY_HORIZON = new THREE.Color('#e8bd8c');
const DAY_ZENITH = new THREE.Color('#9c6144');

// Low-sun palette: deep rust sky with the characteristic cool solar glow.
const DUSK_SUN = new THREE.Color('#ffb27a');
const DUSK_HORIZON = new THREE.Color('#c2724a');
const DUSK_ZENITH = new THREE.Color('#5c3a30');
const DUSK_GLOW = new THREE.Color('#9fc4e8');

// Night: lit only by scattered dust and two small moons.
//
// These are lifted well above physical accuracy on purpose. A real Martian
// night with no moon up is essentially black, which is authentic and no fun to
// play in - you cannot run a colony you cannot see. Treat this as the same
// convention every night scene in film uses: dark enough to read as night,
// bright enough to read at all.
const NIGHT_SUN = new THREE.Color('#8fa4c8');
const NIGHT_HORIZON = new THREE.Color('#3a2a33');
const NIGHT_ZENITH = new THREE.Color('#141c33');

export function createSunState(): SunState {
  return {
    direction: new THREE.Vector3(0, 1, 0),
    elevation: 1,
    intensity: 0,
    color: new THREE.Color(),
    ambientIntensity: 0,
    horizonColor: new THREE.Color(),
    zenithColor: new THREE.Color(),
    glowColor: new THREE.Color(),
    solarFactor: 0,
    nightFactor: 0,
  };
}

/**
 * Recomputes the sun in place.
 *
 * This runs every frame, so it deliberately writes into an existing state
 * object instead of allocating a dozen Vectors and Colors per tick.
 *
 * @param dayFraction 0..1 through the sol. 0 is midnight, 0.25 sunrise,
 *                    0.5 local noon, 0.75 sunset.
 */
export function updateSunState(out: SunState, dayFraction: number): SunState {
  const angle = (dayFraction - 0.25) * Math.PI * 2;

  const direction = out.direction.set(
    Math.cos(angle),
    Math.sin(angle) * Math.cos(PATH_TILT),
    Math.sin(angle) * Math.sin(PATH_TILT),
  );
  direction.normalize();

  const elevation = direction.y;

  // Twilight ramps between -0.12 (astronomical dusk) and 0.18 (full daylight).
  const daylight = smoothstep(-0.12, 0.18, elevation);
  const nightFactor = 1 - daylight;

  // How "low" the sun is while still up - drives the sunset palette.
  const lowSun = daylight * (1 - smoothstep(0.05, 0.42, elevation));

  const color = out.color
    .copy(NIGHT_SUN)
    .lerp(DUSK_SUN, daylight)
    .lerp(DAY_SUN, smoothstep(0.08, 0.5, elevation));

  out.horizonColor
    .copy(NIGHT_HORIZON)
    .lerp(DUSK_HORIZON, daylight)
    .lerp(DAY_HORIZON, smoothstep(0.1, 0.45, elevation));

  out.zenithColor
    .copy(NIGHT_ZENITH)
    .lerp(DUSK_ZENITH, daylight)
    .lerp(DAY_ZENITH, smoothstep(0.05, 0.4, elevation));

  // Blue forward-scattering glow, strongest when the sun sits on the horizon.
  out.glowColor.copy(color).lerp(DUSK_GLOW, lowSun * 0.85);

  // Mars receives ~43% of Earth's irradiance; the peak here is tuned for looks
  // rather than physics, but the shape of the curve is the honest part.
  const intensity = lerp(0.02, 3.1, daylight) * lerp(0.55, 1, smoothstep(0, 0.35, elevation));

  const ambientIntensity = lerp(0.34, 0.55, daylight);

  // Photovoltaic output follows the cosine of the incidence angle and dies at
  // dusk. Colonies that do not store power overnight will find out the hard way.
  const solarFactor = clamp01(Math.max(0, elevation) ** 0.75) * daylight;

  out.elevation = elevation;
  out.intensity = intensity;
  out.ambientIntensity = ambientIntensity;
  out.solarFactor = solarFactor;
  out.nightFactor = nightFactor;

  return out;
}

/** Allocating convenience wrapper, for one-off queries outside the frame loop. */
export function computeSun(dayFraction: number): SunState {
  return updateSunState(createSunState(), dayFraction);
}

/**
 * The live sun for the current frame, updated once per tick by the time
 * controller and read directly by lighting, sky and dust.
 */
export const currentSun = createSunState();

// ---------------------------------------------------------------------------
// Moons
// ---------------------------------------------------------------------------

/**
 * Phobos completes an orbit in 7.65 hours against a 24.66-hour sol, so it
 * crosses the sky roughly three times a night - and because it orbits faster
 * than Mars rotates, it rises in the *west*. Deimos is slower and dimmer, and
 * takes about two and a half days to cross.
 *
 * Both are genuinely tiny - Phobos appears about a third the width of Earth's
 * moon - but they are drawn a little larger than life so they register as
 * moons rather than as bright stars.
 */
const PHOBOS_PERIOD_SOLS = 0.3186;
const DEIMOS_PERIOD_SOLS = 1.229;

export interface MoonState {
  direction: THREE.Vector3;
  elevation: number;
  /** 0 below the horizon or in daylight, up to 1 when high in a dark sky. */
  brightness: number;
}

export const currentMoons: { phobos: MoonState; deimos: MoonState } = {
  phobos: { direction: new THREE.Vector3(0, -1, 0), elevation: -1, brightness: 0 },
  deimos: { direction: new THREE.Vector3(0, -1, 0), elevation: -1, brightness: 0 },
};

function updateMoon(
  moon: MoonState,
  sols: number,
  periodSols: number,
  tilt: number,
  phase: number,
  retrograde: boolean,
  peakBrightness: number,
  nightFactor: number,
): void {
  const angle = ((sols / periodSols) * Math.PI * 2 + phase) * (retrograde ? -1 : 1);

  moon.direction
    .set(Math.cos(angle), Math.sin(angle) * Math.cos(tilt), Math.sin(angle) * Math.sin(tilt))
    .normalize();

  moon.elevation = moon.direction.y;
  moon.brightness = smoothstep(-0.03, 0.16, moon.elevation) * nightFactor * peakBrightness;
}

/** Advances both moons. Called once per frame by the time controller. */
export function updateMoons(sols: number, nightFactor: number): void {
  updateMoon(currentMoons.phobos, sols, PHOBOS_PERIOD_SOLS, 0.28, 1.1, true, 1, nightFactor);
  updateMoon(currentMoons.deimos, sols, DEIMOS_PERIOD_SOLS, -0.55, 2.7, false, 0.45, nightFactor);
}

/** Human-readable clock for the HUD, e.g. "14:32". */
export function formatSolTime(dayFraction: number): string {
  const totalMinutes = Math.floor(clamp01(dayFraction) * 24 * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
