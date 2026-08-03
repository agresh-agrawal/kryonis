'use client';

import dynamic from 'next/dynamic';

/**
 * The imported-model gallery.
 *
 * A developer page, not a game screen. Every downloaded model that made it
 * through `tools/build-models.mjs` is shown here rotating, at real world scale,
 * labelled with the structure it is currently assigned to.
 *
 * It exists because the models arrived named `Cube.017` inside a diorama, and
 * which prop is a habitat and which is an oxygen plant was inferred from
 * bounding-box proportions rather than from looking at them. This is how you
 * look at them. Reassigning is a one-line edit to `IMPORTED_MODELS`.
 *
 * Its own WebGL context is fine here: the game canvas is not mounted on this
 * route, so the two never compete for the sampler budget.
 */
const ModelGallery = dynamic(
  () => import('@/game/ui/ModelGallery').then((mod) => mod.ModelGallery),
  { ssr: false },
);

export default function ModelsPage() {
  return <ModelGallery />;
}
