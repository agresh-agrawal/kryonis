/**
 * Quality tiers.
 *
 * The target is a discrete-GPU desktop running the full effect stack, but the
 * game also has to stay usable on a tablet. Rather than shipping two renderers
 * we detect the device once, pick a tier, and let every visual system read its
 * budget from here. The player can override the auto choice from settings.
 */

export type QualityTier = 'low' | 'medium' | 'high' | 'ultra';

export interface QualitySettings {
  tier: QualityTier;
  /** Device pixel ratio ceiling passed to the canvas. */
  maxDpr: number;
  /** Mesh subdivisions per terrain tile (higher = smoother displacement). */
  terrainSubdivisions: number;
  shadows: boolean;
  shadowMapSize: number;
  /** How far from the camera target shadows are still rendered. */
  shadowDistance: number;
  bloom: boolean;
  ssao: boolean;
  /** Screen-space antialiasing pass (SMAA). */
  smaa: boolean;
  vignette: boolean;
  /** Number of scattered boulder instances across the region. */
  boulderCount: number;
  /** Number of airborne dust motes. */
  dustParticles: number;
  /** Hard ceiling on colonists rendered as animated agents. */
  maxVisibleAgents: number;
  /** Anisotropic filtering level for ground detail maps. */
  anisotropy: number;
}

const TIERS: Record<QualityTier, QualitySettings> = {
  low: {
    tier: 'low',
    maxDpr: 1,
    terrainSubdivisions: 2,
    shadows: false,
    shadowMapSize: 1024,
    shadowDistance: 60,
    bloom: false,
    ssao: false,
    smaa: false,
    vignette: false,
    boulderCount: 250,
    dustParticles: 0,
    maxVisibleAgents: 40,
    anisotropy: 1,
  },
  medium: {
    tier: 'medium',
    maxDpr: 1.25,
    terrainSubdivisions: 3,
    shadows: true,
    shadowMapSize: 2048,
    shadowDistance: 80,
    bloom: true,
    ssao: false,
    smaa: true,
    vignette: true,
    boulderCount: 700,
    dustParticles: 400,
    maxVisibleAgents: 90,
    anisotropy: 4,
  },
  high: {
    tier: 'high',
    maxDpr: 1.5,
    terrainSubdivisions: 3,
    shadows: true,
    shadowMapSize: 4096,
    shadowDistance: 110,
    bloom: true,
    ssao: false,
    smaa: true,
    vignette: true,
    boulderCount: 1300,
    dustParticles: 500,
    maxVisibleAgents: 150,
    anisotropy: 8,
  },
  ultra: {
    tier: 'ultra',
    maxDpr: 2,
    terrainSubdivisions: 3,
    shadows: true,
    shadowMapSize: 4096,
    shadowDistance: 150,
    bloom: true,
    ssao: false,
    smaa: true,
    vignette: true,
    boulderCount: 1900,
    dustParticles: 600,
    maxVisibleAgents: 240,
    anisotropy: 16,
  },
};

export function getQualitySettings(tier: QualityTier): QualitySettings {
  return TIERS[tier];
}

export const QUALITY_TIERS: QualityTier[] = ['low', 'medium', 'high', 'ultra'];

/**
 * Best-effort hardware sniff. WebGL's unmasked renderer string is the most
 * reliable signal available in a browser; everything else is a fallback.
 * Errs toward a lower tier - a smooth colony beats a pretty slideshow.
 */
export function detectQualityTier(): QualityTier {
  if (typeof window === 'undefined') return 'high';

  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const smallScreen = Math.min(window.screen.width, window.screen.height) < 820;
  if (coarsePointer && smallScreen) return 'low';

  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;

  let renderer = '';
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') ??
      canvas.getContext('webgl')) as WebGLRenderingContext | null;
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      if (ext) {
        renderer = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? '').toLowerCase();
      }
      const lose = gl.getExtension('WEBGL_lose_context');
      lose?.loseContext();
    }
  } catch {
    // Renderer sniffing is a nice-to-have; fall through to the CPU heuristics.
  }

  if (coarsePointer) return 'medium';

  const discrete = /nvidia|geforce|rtx|gtx|radeon|rx\s?\d|arc a\d|apple m\d/.test(renderer);
  const integrated = /intel|uhd|iris|hd graphics|mali|adreno|swiftshader|llvmpipe/.test(renderer);

  if (/swiftshader|llvmpipe|software/.test(renderer)) return 'low';
  if (discrete && cores >= 8 && memory >= 8) return 'ultra';
  if (discrete) return 'high';
  if (integrated) return cores >= 8 ? 'medium' : 'low';

  // Unknown GPU - judge by CPU and memory alone.
  if (cores >= 12 && memory >= 8) return 'high';
  if (cores >= 6) return 'medium';
  return 'low';
}
