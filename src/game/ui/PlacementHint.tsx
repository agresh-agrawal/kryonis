'use client';

import { BUILDINGS } from '../buildings/catalog';
import { formatAmount } from '../core/resources';
import { useBuildStore } from '../state/useBuildStore';
import { useRoadStore } from '../state/useRoadStore';
import { ROAD_GRADES } from '../world/roadGrades';

/**
 * Placement feedback.
 *
 * A single line above the deck. When a spot is illegal the player is told why -
 * too steep, occupied, outside the claim - because a red outline with no reason
 * is the fastest way to make a builder feel arbitrary.
 */
export function PlacementHint() {
  const tool = useBuildStore((state) => state.tool);
  const selectedType = useBuildStore((state) => state.selectedType);
  const hint = useBuildStore((state) => state.hint);
  const rotate = useBuildStore((state) => state.rotate);
  const cancel = useBuildStore((state) => state.cancel);
  const grade = useRoadStore((state) => state.grade);

  /*
   * The road tool needs the same line the build tool gets.
   *
   * It is a drag rather than a click, which is not obvious, and the two things
   * a player has to know - that dragging paints a run, and that dragging back
   * over your own work lifts it - were previously only in a tooltip on a button
   * they had already stopped looking at.
   */
  if (tool === 'road') {
    const def = ROAD_GRADES[grade];
    return (
      <div className="glass anim-rise pointer-events-auto flex items-center gap-3 rounded-full px-4 py-1.5">
        <span className="t-sm text-bone">{def.name}</span>
        <span className="rule-y h-3.5" />
        {hint ? (
          <span className="t-sm text-alert">{hint}</span>
        ) : (
          <span className="t-sm text-ash">
            Drag to lay · {formatAmount(def.cost)} a tile
            {grade === 2 ? ` · ${formatAmount(def.upgradeCost)} to seal an existing road` : ''}
          </span>
        )}
        <button type="button" onClick={cancel} className="t-micro press hover:text-bone">
          Esc
        </button>
      </div>
    );
  }

  if (tool === 'demolish') {
    return (
      <div className="glass anim-rise pointer-events-auto flex items-center gap-3 rounded-full px-4 py-1.5">
        <span className="anim-breathe h-1.5 w-1.5 rounded-full bg-alert" />
        <span className="t-sm text-alert">Select a structure to remove</span>
        <button type="button" onClick={cancel} className="t-micro press hover:text-bone">
          Esc
        </button>
      </div>
    );
  }

  if (tool !== 'build' || !selectedType) return null;

  return (
    <div className="glass anim-rise pointer-events-auto flex items-center gap-3 rounded-full px-4 py-1.5">
      <span className="t-sm text-bone">{BUILDINGS[selectedType].name}</span>
      <span className="rule-y h-3.5" />
      {hint ? (
        <span className="t-sm text-alert">{hint}</span>
      ) : (
        <span className="t-sm text-good">Ready to place</span>
      )}
      <button type="button" onClick={rotate} className="t-micro press hover:text-bone">
        R · Rotate
      </button>
    </div>
  );
}
