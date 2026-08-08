'use client';

import { useRoadStore } from '../state/useRoadStore';

/**
 * The grid readout.
 *
 * This used to be the road *tool* as well, which put the control that creates
 * the colony's most common problem in a different place from every other thing
 * you build. Laying road now happens in the Roads tray of the construction
 * deck, alongside the structures it connects, and what is left here is the
 * instrument: how many separate grids exist, how many of them are live, and
 * how much of the network has been sealed.
 *
 * Those three numbers answer the question the player actually arrives with -
 * "why is that building dark?" - because the overwhelmingly common answer is
 * "you have two grids and the generator is on the other one".
 *
 * The overlay toggle stays here rather than in the deck because it is a way of
 * *looking* at the colony, not a way of changing it, and it has to be reachable
 * without entering build mode.
 */
export function RoadChip({ onOpenRoads }: { onOpenRoads: () => void }) {
  const networks = useRoadStore((state) => state.networks);
  const showUtilities = useRoadStore((state) => state.showUtilities);
  const setShowUtilities = useRoadStore((state) => state.setShowUtilities);

  const live = networks.powered.filter(Boolean).length;
  const sealed = networks.tiles > 0 ? networks.sealedTiles / networks.tiles : 0;

  return (
    <div className="glass anim-fade pointer-events-auto flex items-center gap-2.5 rounded-[3px] px-2.5 py-2">
      <button
        type="button"
        onClick={onOpenRoads}
        title="Open the road tray"
        className="press flex items-center gap-2 rounded-[2px] px-1 py-0.5 text-titanium transition-colors hover:text-bone"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current" aria-hidden>
          {/* A road running to the horizon, with its centre line. */}
          <path d="M6.5 18L8.6 2h2.8L13.5 18h-3l-.4-4h-.2l-.4 4z" opacity="0.85" />
          <path d="M9.7 5h0.6v2h-0.6zM9.7 9h0.6v2h-0.6zM9.7 13h0.6v2h-0.6z" opacity="0.5" />
        </svg>
        <span className="flex flex-col items-start">
          <span className="t-micro">Grid</span>
          <span className="t-num mt-1 text-[0.7rem] text-ash">
            {networks.tiles === 0 ? 'None laid' : `${networks.tiles} tiles`}
          </span>
        </span>
      </button>

      <span className="rule-y h-7" />

      {/*
        Live grids out of total.

        Two separate networks is the single most common reason a colony has
        power in one place and none in another, so it is worth saying out loud
        the moment there is more than one.
      */}
      {networks.count > 0 ? (
        <span
          className="flex flex-col items-start"
          title={
            networks.count > 1
              ? `${live} of ${networks.count} grids have a generator on them`
              : 'The colony is one connected grid'
          }
        >
          <span className="t-micro">Live</span>
          <span className={`t-num mt-1 text-[0.7rem] ${live < networks.count ? 'text-warn' : 'text-good'}`}>
            {live}/{networks.count}
          </span>
        </span>
      ) : null}

      {/* Sealed share. Only once there is something to seal. */}
      {networks.tiles > 0 ? (
        <span
          className="flex flex-col items-start"
          title="Share of the network built as sealed transit way. Raises colony morale."
        >
          <span className="t-micro">Sealed</span>
          <span className={`t-num mt-1 text-[0.7rem] ${sealed > 0 ? 'text-dust' : 'text-faint'}`}>
            {Math.round(sealed * 100)}%
          </span>
        </span>
      ) : null}

      <span className="rule-y h-7" />

      <button
        type="button"
        onClick={() => setShowUtilities(!showUtilities)}
        aria-pressed={showUtilities}
        title="Highlight the power and water lines across the whole colony"
        className={`press grid h-8 w-8 place-items-center rounded-[2px] transition-colors ${
          showUtilities ? 'bg-white/10 text-dust' : 'text-titanium hover:bg-white/5 hover:text-bone'
        }`}
      >
        {/* Two stacked conduits: the thing the button reveals. */}
        <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
          <path d="M2 5.5h12" stroke="#f0c657" strokeWidth="2" strokeLinecap="round" />
          <path d="M2 10.5h12" stroke="#4fa8e0" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
