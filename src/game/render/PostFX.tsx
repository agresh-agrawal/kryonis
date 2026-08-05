'use client';

import type { JSX } from 'react';
import { useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';

import type { QualitySettings } from '../core/quality';

/**
 * The post-processing chain.
 *
 * The composer is always mounted, even at the lowest quality tier, because it
 * owns the frame's tone mapping and colour-space conversion - every material in
 * the game writes linear HDR values and relies on this pass to resolve them.
 * The quality tier decides what else runs alongside it.
 *
 * Order matters: ambient occlusion needs scene depth before anything smears the
 * image, bloom reads the HDR buffer before tone mapping compresses it, and
 * antialiasing runs last on the final resolved colours.
 *
 * The passes are collected into an array rather than written as conditional
 * JSX because EffectComposer's children must all be elements - a `false` or
 * `null` child is a type error, not an omitted effect.
 */
export function PostFX({ quality }: { quality: QualitySettings }) {
  const gl = useThree((state) => state.gl);

  /**
   * Never build the composer against a dead context.
   *
   * postprocessing reads `renderer.getContext().getContextAttributes().alpha`
   * when it allocates its buffers. If the WebGL context has been lost - or was
   * never granted, which happens when too many contexts are open at once - that
   * call throws on null and takes the whole canvas down. Rendering the scene
   * without post-processing is a far better failure than rendering nothing.
   */
  // Checked on every render, deliberately not memoised: the renderer can be
  // torn down and rebuilt (hot reload, a lost context, a quality change), and a
  // cached "the context was fine once" answer is exactly how the composer ends
  // up constructing itself against a dead one.
  /*
   * Check the exact call postprocessing makes, not a proxy for it.
   *
   * This used to test `gl.getContext() != null`, which is not the same
   * question and let the crash through: a lost context still returns a
   * non-null object from `getContext()`, but `getContextAttributes()` on it
   * returns null - and that is the call whose `.alpha` postprocessing reads.
   * The guard passed, the composer was built anyway, and the canvas went down
   * with "Cannot read properties of null (reading 'alpha')".
   */
  let contextAlive = false;
  try {
    const context = gl.getContext();
    contextAlive = context != null && context.getContextAttributes() != null;
  } catch {
    contextAlive = false;
  }

  if (!contextAlive) return null;

  const passes: JSX.Element[] = [];

  /*
   * Ambient occlusion is deliberately off.
   *
   * N8AO renders the scene a second time into depth and normal buffers before
   * doing a multi-sample screen-space gather. On a scene this size that was the
   * single most expensive thing in the frame, and its buffers contributed to
   * blowing the fragment sampler budget. The contact shading it bought is not
   * worth what it cost; re-enable only if the frame budget ever allows.
   */

  if (quality.bloom) {
    passes.push(
      <Bloom
        key="bloom"
        mipmapBlur
        intensity={0.62}
        radius={0.72}
        // High threshold: only the solar disc and emissive panels should glow.
        luminanceThreshold={0.82}
        luminanceSmoothing={0.28}
      />,
    );
  }

  passes.push(<ToneMapping key="tonemap" mode={ToneMappingMode.AGX} />);

  if (quality.vignette) {
    passes.push(
      <Vignette key="vignette" offset={0.3} darkness={0.55} blendFunction={BlendFunction.NORMAL} />,
    );
  }

  if (quality.smaa) {
    passes.push(<SMAA key="smaa" />);
  }

  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      {passes}
    </EffectComposer>
  );
}
