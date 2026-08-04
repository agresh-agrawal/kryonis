/** World-scale constants shared by terrain, placement and rendering. */

/** Tiles per side of the playable region. */
export const REGION_TILES = 96;

/** World units per tile. A 1x1 building is this wide. */
export const TILE_SIZE = 2;

/** Total world width in world units. */
export const WORLD_SIZE = REGION_TILES * TILE_SIZE;

/** Half-extent, handy for centring the region on the origin. */
export const WORLD_HALF = WORLD_SIZE / 2;

/**
 * The colony sits in an impact crater.
 *
 * This is a design decision as much as a terrain one: a circular valley ringed
 * by its own wall gives the playable area a boundary that exists in the world
 * rather than an invisible wall at the edge of a square tile grid. The player
 * cannot leave because there is a 30-metre escarpment in the way, which is a
 * reason, not a restriction.
 *
 * Radii are in world units, measured from the origin.
 */
/** Out to here the crater floor is gentle and buildable. */
export const VALLEY_FLOOR_RADIUS = 84;
/** The wall climbs from the floor radius to this crest. */
export const VALLEY_CREST_RADIUS = 118;
/** Height of the crater rim above the floor. */
export const VALLEY_RIM_HEIGHT = 44;
/** How far the surrounding highlands are generated before fog takes over. */
export const OUTER_TERRAIN_RADIUS = 1400;

/**
 * Territory is unlocked as an expanding perimeter rather than as square zones -
 * a circular valley wants concentric growth.
 */
export const START_UNLOCK_RADIUS = 44;

/**
 * Cost of one road tile.
 *
 * Deliberately small. Roads are the thing that makes every other structure
 * work, so pricing them like a building would turn the colony's circulatory
 * system into a luxury and leave players with a crater full of dead hardware.
 */
export const ROAD_COST = 45;
export const UNLOCK_STEP = 10;

/** Slope above which terrain is considered cliff and cannot be built on. */
export const MAX_BUILDABLE_SLOPE = 0.42;

/**
 * Length of one Martian sol in real seconds at 1x speed.
 *
 * 24 minutes: long enough that a day feels like a day and the player can work
 * through a whole build without the sun racing overhead, short enough that the
 * night/day cycle still matters for solar power within one session. Speed
 * controls scale this, so 4x gives a six-minute sol for when nothing is urgent.
 */
export const SOL_DURATION_SECONDS = 1440;

/** Palette shared between the 3D scene and the HUD. */
export const PALETTE = {
  regolithLight: '#c98a52',
  regolithMid: '#a85f35',
  regolithDark: '#7c4227',
  basalt: '#4a2f24',
  dust: '#d9a06a',
  ice: '#bcd2da',
  lava: '#3a2119',
  skyHorizon: '#e6b483',
  skyZenith: '#6b4030',
  sunLight: '#ffd7ad',
  tech: '#4fd6e0',
  techDim: '#1d7f89',
  alert: '#ff6b47',
} as const;
