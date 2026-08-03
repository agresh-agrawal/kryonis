'use client';

import { useState } from 'react';

import { useColonyStore } from '../state/useColonyStore';

const TONE = {
  critical: { dot: 'bg-alert', text: 'text-alert' },
  warning: { dot: 'bg-warn', text: 'text-warn' },
  info: { dot: 'bg-titanium', text: 'text-ash' },
} as const;

/**
 * Colony notifications.
 *
 * At rest this is a single line: one dot per open issue and a count. It only
 * becomes a list when the player asks for one.
 *
 * The reasoning is that alerts are a *second-priority* signal. A permanently
 * expanded feed trains the player to stop seeing it, and the one time it
 * genuinely matters - life support failing - it looks exactly like the four
 * advisory notices that have been sitting there for ten minutes. Collapsed by
 * default, colour only when it counts.
 */
export function Notifications() {
  const alerts = useColonyStore((state) => state.stats.alerts);
  const [open, setOpen] = useState(false);

  if (alerts.length === 0) return null;

  const order = { critical: 0, warning: 1, info: 2 } as const;
  const sorted = [...alerts].sort((a, b) => order[a.severity] - order[b.severity]);
  const worst = sorted[0].severity;
  const critical = sorted.filter((alert) => alert.severity === 'critical').length;

  return (
    <div className="pointer-events-auto flex flex-col items-start gap-1.5">
      {open ? (
        <div className="glass anim-rise w-64 overflow-hidden rounded-[3px]">
          {sorted.slice(0, 6).map((alert, index) => (
            <div key={alert.id}>
              {index > 0 ? <span className="rule-x mx-3 block" /> : null}
              <div className="flex items-start gap-2.5 px-3 py-2.5">
                <span
                  className={`mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full ${TONE[alert.severity].dot} ${
                    alert.severity === 'critical' ? 'anim-breathe' : ''
                  }`}
                />
                <span className={`t-sm leading-snug ${TONE[alert.severity].text}`}>
                  {alert.message}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        title={`${alerts.length} colony notice${alerts.length === 1 ? '' : 's'}`}
        className="glass press flex items-center gap-2.5 rounded-[3px] px-3 py-2"
      >
        <span className="flex items-center gap-1">
          {sorted.slice(0, 4).map((alert, index) => (
            <span
              key={`${alert.id}-${index}`}
              className={`h-1.5 w-1.5 rounded-full ${TONE[alert.severity].dot} ${
                alert.severity === 'critical' ? 'anim-breathe' : ''
              }`}
            />
          ))}
        </span>

        <span className={`t-micro ${critical > 0 ? 'text-alert' : ''}`}>
          {critical > 0 ? `${critical} critical` : `${alerts.length} notices`}
        </span>

        <svg
          viewBox="0 0 12 12"
          className={`h-2.5 w-2.5 fill-titanium transition-transform duration-300 ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden
        >
          <path d="M1 4l5 5 5-5z" />
        </svg>
      </button>
    </div>
  );
}
