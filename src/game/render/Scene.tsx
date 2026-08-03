'use client';

import { useEffect } from 'react';

import { AudioController } from '../audio/AudioController';
import { BuildingsLayer } from '../buildings/BuildingsLayer';
import { ColonistsLayer } from '../colonists/ColonistsLayer';
import { BuildGrid } from '../build/BuildGrid';
import { PlacementController } from '../build/PlacementController';
import { useBuildStore } from '../state/useBuildStore';
import { useColonyStore } from '../state/useColonyStore';
import { useQuality } from '../state/useSettingsStore';
import { useWorldStore } from '../state/useWorldStore';
import { Boulders } from '../world/Boulders';
import { DustMotes } from '../world/DustMotes';
import { MarsSky } from '../world/MarsSky';
import { TerrainMesh } from '../world/TerrainMesh';
import { CameraRig } from './CameraRig';
import { Lighting } from './Lighting';
import { PostFX } from './PostFX';
import { SimulationController } from './SimulationController';
import { TimeController } from './TimeController';

/**
 * Everything inside the WebGL canvas.
 *
 * Kept flat and explicit rather than clever: each subsystem is one component
 * that reads the world and quality settings for itself, so a milestone can add
 * or remove a layer without threading props through the tree.
 */
export function Scene() {
  const terrain = useWorldStore((state) => state.terrain);
  const quality = useQuality();
  const initialise = useColonyStore((state) => state.initialise);
  const buildingCount = useColonyStore((state) => state.buildings.length);
  const tool = useBuildStore((state) => state.tool);

  // Seat the starting lander once the region exists, and again whenever the
  // player loads a different landing site.
  useEffect(() => {
    if (buildingCount === 0) initialise(terrain);
  }, [terrain, initialise, buildingCount]);

  return (
    <>
      <TimeController />
      <AudioController />
      <SimulationController />
      <CameraRig terrain={terrain} />

      <MarsSky />
      <Lighting quality={quality} />

      <TerrainMesh terrain={terrain} quality={quality} />
      <Boulders terrain={terrain} quality={quality} />

      <BuildingsLayer terrain={terrain} quality={quality} />
      <ColonistsLayer terrain={terrain} quality={quality} />
      <BuildGrid terrain={terrain} active={tool !== 'select'} />
      <PlacementController terrain={terrain} />

      <DustMotes quality={quality} />

      {/*
        The ground-haze cylinder has been removed.

        It enclosed the camera and drew after the terrain with depth writing
        off, so its densest band - intended for the horizon - landed over the
        lower half of the screen, which is precisely where the ground is. The
        result was an orange sheet across the whole view with the world behind
        it. Distance haze is the scene fog's job, and the fog already does it
        correctly because it attenuates by actual distance rather than by
        screen position.
      */}

      <PostFX quality={quality} />
    </>
  );
}
