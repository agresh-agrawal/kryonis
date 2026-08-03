'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

import { AutoSave } from '@/game/save/AutoSave';
import { clearSave, hasSave } from '@/game/save/saveGame';
import { loadSave } from '@/game/save/useSaveGame';
import { BootVideo, consumeTrailerRequest } from '@/game/ui/BootVideo';
import { BuildDeck } from '@/game/ui/BuildDeck';
import { CodexConsole } from '@/game/ui/CodexConsole';
import { CrewConsole } from '@/game/ui/CrewConsole';
import { DirectivePanel } from '@/game/ui/DirectivePanel';
import { Dock, type DockKey } from '@/game/ui/Dock';
import { FloatingInspector } from '@/game/ui/FloatingInspector';
import { Minimap } from '@/game/ui/Minimap';
import { NewColony } from '@/game/ui/NewColony';
import { Notifications } from '@/game/ui/Notifications';
import { PlacementHint } from '@/game/ui/PlacementHint';
import { ResearchConsole } from '@/game/ui/ResearchConsole';
import { SettingsMenu } from '@/game/ui/SettingsMenu';
import { TerritoryChip } from '@/game/ui/TerritoryChip';
import { TerritoryConsole } from '@/game/ui/TerritoryConsole';
import { TimePill } from '@/game/ui/TimePill';
import { Toasts } from '@/game/ui/Toasts';
import { TopBar } from '@/game/ui/TopBar';
import { useBuildStore } from '@/game/state/useBuildStore';
import { useColonyStore } from '@/game/state/useColonyStore';
import { useCrewStore } from '@/game/state/useCrewStore';
import { useProfileStore } from '@/game/state/useProfileStore';
import { useProgressStore } from '@/game/state/useProgressStore';
import { useTimeStore } from '@/game/state/useTimeStore';
import { useToastStore } from '@/game/state/useToastStore';
import { useWorldStore } from '@/game/state/useWorldStore';

/**
 * The 3D canvas is client-only: it touches WebGL, the device pixel ratio and
 * canvas-generated textures, none of which exist during server rendering.
 */
const GameCanvas = dynamic(
  () => import('@/game/render/GameCanvas').then((mod) => mod.GameCanvas),
  { ssr: false, loading: () => <LoadingScreen /> },
);

function LoadingScreen() {
  return (
    <div className="absolute inset-0 grid place-items-center overflow-hidden bg-void">
      <video
        src="/media/kryonis-loading.mp4"
        muted
        playsInline
        autoPlay
        loop
        preload="auto"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_45%,rgb(12_10_9_/_0.55))]" />
      <div className="anim-fade relative flex flex-col items-center gap-5">
        <span className="text-[1.6rem] font-light tracking-[0.55em] text-bone">KRYONIS</span>
        <span className="h-px w-40 overflow-hidden bg-white/10">
          <span className="block h-px w-1/3 animate-[slide-in-left_1.6s_ease-in-out_infinite] bg-dust" />
        </span>
        <span className="t-micro">Surveying landing site</span>
      </div>
    </div>
  );
}

export default function Page() {
  const siteName = useWorldStore((state) => state.siteName);
  const corporation = useProfileStore((state) => state.corporation);
  const [section, setSection] = useState<DockKey>('overview');
  const [booted, setBooted] = useState(false);

  /*
   * Whether a colony is running.
   *
   * A returning player is put straight back into their colony rather than being
   * shown the new-game screen with a Continue button on it. Being asked to
   * confirm that you would like to keep playing the game you were already
   * playing is not a real choice - the save exists, so it is what you meant.
   * Starting fresh is still available, from Settings, where a destructive action
   * belongs.
   */
  const [started, setStarted] = useState(false);
  const [resuming, setResuming] = useState(true);
  const [playTrailer, setPlayTrailer] = useState(false);

  const tool = useBuildStore((state) => state.tool);
  const cancel = useBuildStore((state) => state.cancel);

  // The deck is a mode, not a permanent fixture. Escape closes it, and closing
  // it returns the whole lower third of the screen to Mars.
  const deckOpen = section === 'build';

  /*
   * Four sections take the whole screen instead of a rail.
   *
   * Crew, research, territory and the codex are all decisions made sitting
   * still, and squeezing them into a 17rem column beside a live 3D scene was
   * what made the text unreadable and the panels collide. While one is open the
   * HUD is not rendered at all - not merely covered - so nothing underneath can
   * steal a click or a keystroke.
   */
  const consoleSection =
    section === 'crew' || section === 'research' || section === 'territory' || section === 'codex'
      ? section
      : null;

  const closeConsole = () => setSection('overview');

  useEffect(() => {
    if (tool === 'select' && deckOpen) setSection('overview');
  }, [tool, deckOpen]);

  /*
   * Restore the previous colony, once, on first mount.
   *
   * Deliberately not gated on `booted`: the save is small and restoring it is
   * synchronous, so doing it while the intro video is still playing means the
   * colony is already standing the moment the video ends.
   *
   * `loadSave` touches localStorage, so it cannot run during render or on the
   * server.
   */
  useEffect(() => {
    if (hasSave() && loadSave()) setStarted(true);
    // "Replay intro" from Settings asks for the trailer on the next launch.
    else if (consumeTrailerRequest()) setPlayTrailer(true);
    setResuming(false);
  }, []);

  const closeDeck = () => {
    setSection('overview');
    cancel();
  };

  /**
   * Returns to the opening screen with nothing carried over.
   *
   * Every store that holds colony state is reset explicitly rather than by
   * reloading the page: a reload would replay the whole boot sequence and
   * re-download the intro video, and it would lose the reason the player is
   * here - they want a new colony, not a restarted browser tab.
   */
  const resetWorld = () => {
    clearSave();
    cancel();
    useWorldStore.getState().reset();
    useProgressStore.getState().reset();
    useCrewStore.getState().reset();
    useTimeStore.getState().reset();
    useProfileStore.getState().reset();
    useToastStore.getState().clear();
    useColonyStore.setState({
      buildings: [],
      selectedId: null,
    });
    setSection('overview');
    setStarted(false);
  };

  return (
    <main className="relative h-dvh w-screen overflow-hidden bg-void">
      {/*
        The world mounts immediately, underneath the intro video rather than
        after it. Terrain generation is a one-to-two second main-thread stall and
        shader compilation is another; running both while the video plays means
        the player pays for them once instead of twice, and "Skip" lands on a
        colony that is already there.
      */}
      <GameCanvas />
      {booted ? null : <BootVideo onComplete={() => setBooted(true)} />}
      {started ? <AutoSave /> : null}
      {booted && !started && !resuming ? (
        <NewColony
          onBegin={() => {
            // Founding a colony is what the trailer is for, so it plays here
            // rather than on first page load.
            setPlayTrailer(true);
            setStarted(true);
          }}
        />
      ) : null}

      {/* The founding briefing. Plays over the world, which is already built. */}
      {playTrailer ? (
        <BootVideo variant="trailer" onComplete={() => setPlayTrailer(false)} />
      ) : null}

      {/* Full-screen consoles. Rendered above the HUD and replacing it. */}
      {started && consoleSection === 'crew' ? <CrewConsole onClose={closeConsole} /> : null}
      {started && consoleSection === 'research' ? <ResearchConsole onClose={closeConsole} /> : null}
      {started && consoleSection === 'territory' ? (
        <TerritoryConsole onClose={closeConsole} />
      ) : null}
      {started && consoleSection === 'codex' ? <CodexConsole onClose={closeConsole} /> : null}

      <Toasts />

      {/*
        The interface lives entirely on the edges. Nothing is permitted in the
        centre of the viewport: that space belongs to the colony, and every
        element below is positioned against a screen edge rather than flowing in
        a document.

        Unmounted rather than hidden while a console is open. A HUD that is
        merely covered still holds focus, still answers keyboard shortcuts, and
        still repaints a dozen readouts four times a second behind an opaque
        screen the player cannot see through.
      */}
      {consoleSection !== null || !started ? null : (
      <div className="pointer-events-none absolute inset-0 z-10 hud-scale">
        {/* --- Top: identity, then the instrument strip --- */}
        <div className="absolute inset-x-0 top-0 flex flex-nowrap items-start justify-between gap-2 p-2 min-[640px]:p-3">
          <div className="glass anim-fade pointer-events-auto hidden flex-col rounded-[3px] px-3 py-2 min-[1180px]:flex">
            <span className="t-md max-w-[13rem] truncate leading-none text-bone">
              {corporation}
            </span>
            <span className="t-micro mt-1.5">{siteName}</span>
          </div>

          <div className="min-w-0 flex-1">
            <TopBar />
          </div>

          <span className="flex items-start gap-2">
            <TimePill />
            <SettingsMenu onResetWorld={resetWorld} />
          </span>
        </div>

        {/*
          Left column. Dock, notices and map are stacked in one flow rather
          than pinned to opposite corners - pinning is what let the map ride up
          over the dock and bury the notice chip once the viewport got short.
        */}
        <div className="absolute bottom-3 left-3 top-20 flex w-[3.5rem] flex-col items-start justify-between gap-2 min-[1180px]:bottom-4 min-[1180px]:left-4 min-[1180px]:top-24 min-[1180px]:w-44 min-[1180px]:gap-3">
          <Dock active={section} onSelect={setSection} />
          <div className="flex flex-col items-start gap-2.5">
            <Notifications />
            <Minimap />
          </div>
        </div>

        {/*
          Right rail.

          Sits below the settings button rather than beside it - both were
          previously anchored to the same corner, so opening settings dropped a
          panel straight over the directives. The rail scrolls internally and is
          height-capped so it can never reach the build deck either.
        */}
        <div
          className="quiet-scroll absolute right-3 top-28 flex max-h-[calc(100dvh-10rem)] w-[min(17.5rem,calc(100vw-5rem))] flex-col items-end gap-2 overflow-y-auto overflow-x-hidden pr-0.5 min-[1180px]:right-4 min-[1180px]:top-36 min-[1180px]:max-h-[calc(100dvh-18rem)]"
        >
          <TerritoryChip onOpen={() => setSection('territory')} />
          <DirectivePanel />
          <FloatingInspector />
        </div>

        {/*
          Bottom deck. Inset past the left column and the right rail so the
          build shelf can never slide underneath either of them.
        */}
        <div className="absolute bottom-3 left-[4.5rem] right-3 flex flex-col items-center gap-2 min-[1180px]:bottom-4 min-[1180px]:left-52 min-[1180px]:right-[18rem] min-[1180px]:gap-3">
          <PlacementHint />
          {deckOpen ? <BuildDeck onDismiss={closeDeck} /> : null}
        </div>
      </div>
      )}
    </main>
  );
}
