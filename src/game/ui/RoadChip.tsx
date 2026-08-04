'use client';

import { ROAD_COST } from '../core/constants';
import { formatAmount } from '../core/resources';
import { useBuildStore } from '../state/useBuildStore';
import { useColonyStore } from '../state/useColonyStore';
import { useRoadStore } from '../state/useRoadStore';

/**
 * The road tool, and the utility overlay that goes with it.
 *
 * Roads are not in the build deck because they are not a structure - they are
 * the thing structures plug into, and they are laid by dragging rather than by
 * placing. Giving them their own control next to demolish says that clearly.
 *
 * The overlay toggle is the diagnostic: it brightens both conduits across the
 * whole colony so a player can see at a glance which runs are live and where
 * the network stops. That is the answer to "why is this building not working",
 * and it needs to be one click away from the tool that causes the problem.
 */
export function RoadChip() {
  const tool = useBuildStore((state) => state.tool);
  const setTool = useBuildStore((state) => state.setTool);
  const cancel = useBuildStore((state) => state.cancel);

  const networks = useRoadStore((state) => state.networks);
  const showUtilities = useRoadStore((state) => state.showUtilities);
  const setShowUtilities = useRoadStore((state) => state.setShowUtilities);
  const money = useColonyStore((state) => state.stock.money);

  const active = tool === 'road';
  const live = networks.powered.filter(Boolean).length;

  return (
    <div className="glass anim-fade pointer-events-auto flex items-center gap-2.5 rounded-[3px] px-2.5 py-2">
      <button
        type="button"
        onClick={() => (active ? cancel() : setTool('road'))}
        aria-pressed={active}
        title={`Lay road — ${formatAmount(ROAD_COST)} credits a tile. Drag to draw, drag over a road to remove it.`}
        className={`press flex items-center gap-2 rounded-[2px] px-1.5 py-1 transition-colors ${
          active ? 'text-dust' : 'text-titanium hover:text-bone'
        }`}
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current" aria-hidden>
          {/* A road running to the horizon, with its centre line. */}
          <path d="M6.5 18L8.6 2h2.8L13.5 18h-3l-.4-4h-.2l-.4 4z" opacity="0.85" />
          <path d="M9.7 5h0.6v2h-0.6zM9.7 9h0.6v2h-0.6zM9.7 13h0.6v2h-0.6z" opacity="0.5" />
        </svg>
        <span className="flex flex-col items-start">
          <span className="t-micro">Road</span>
          <span className={`t-num mt-1 text-[0.7rem] ${money >= ROAD_COST ? '' : 'text-warn'}`}>
            {formatAmount(ROAD_COST)}
          </span>
        </span>
      </button>

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

      {/*
        Network count, only once there is more than one.
        Two separate grids is the single most common reason a colony has power
        somewhere and no power somewhere else, so it is worth saying out loud.
      */}
      {networks.count > 1 ? (
        <span className="flex flex-col items-start">
          <span className="t-micro">Grids</span>
          <span className={`t-num mt-1 text-[0.7rem] ${live < networks.count ? 'text-warn' : ''}`}>
            {live}/{networks.count}
          </span>
        </span>
      ) : null}
    </div>
  );
}
