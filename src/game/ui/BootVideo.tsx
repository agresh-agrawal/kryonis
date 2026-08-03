'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const TRAILER_VIDEO = '/media/trailer.mp4';
const BOOT_VIDEO = '/media/kryonis-loading.mp4';

/** Hard ceiling on the short loading clip, in case it never fires `ended`. */
const MAX_BOOT_MS = 12000;
/** Hard ceiling on the trailer. Long, because the trailer is long. */
const MAX_TRAILER_MS = 4 * 60 * 1000;

const SEEN_KEY = 'kryonis:seenTrailer';
const REPLAY_KEY = 'kryonis:replayTrailer';

/** Clears the first-run flag so the trailer plays again next launch. */
export function requestTrailerReplay(): void {
  try {
    window.localStorage.setItem(REPLAY_KEY, '1');
  } catch {
    // Storage unavailable; the replay simply will not persist.
  }
}

/**
 * The opening video.
 *
 * The trailer plays once, on a player's first ever launch, and the short
 * loading clip on every launch after that.
 *
 * The trailer is a very large file, and the decision was made deliberately to
 * ship it at full size rather than compress it. Two things make that survivable:
 *
 * 1. The 3D world mounts *behind* this screen rather than after it. Terrain
 *    generation, texture baking and shader compilation all happen while the
 *    video plays, so the wait buys something instead of being spent twice.
 * 2. Skip is available from the first frame. A player who does not want a
 *    three-minute trailer must never be made to sit through the buffering of
 *    one, and the skip is the only control on screen so it cannot be missed.
 *
 * The progress bar under the title reports *buffering*, not playback - it is
 * answering "is this thing working", which is the only question a player has
 * while staring at a black rectangle.
 */
export function BootVideo({ onComplete }: { onComplete: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [buffered, setBuffered] = useState(0);
  const [playing, setPlaying] = useState(false);

  const [isTrailer] = useState(() => {
    try {
      if (window.localStorage.getItem(REPLAY_KEY) === '1') return true;
      return window.localStorage.getItem(SEEN_KEY) !== '1';
    } catch {
      // Without storage we cannot tell first run from tenth. Assume returning,
      // because a trailer forced on every launch is far worse than one missed.
      return false;
    }
  });

  const [src, setSrc] = useState(() => (isTrailer ? TRAILER_VIDEO : BOOT_VIDEO));

  const finish = useCallback(() => {
    try {
      window.localStorage.setItem(SEEN_KEY, '1');
      window.localStorage.removeItem(REPLAY_KEY);
    } catch {
      // Ignore storage failures (private browsing, quota).
    }
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    const timeout = window.setTimeout(finish, src === TRAILER_VIDEO ? MAX_TRAILER_MS : MAX_BOOT_MS);
    videoRef.current?.play().catch(() => setBlocked(true));
    return () => window.clearTimeout(timeout);
  }, [finish, src]);

  return (
    <div className="absolute inset-0 z-[80] grid place-items-center overflow-hidden bg-void">
      <video
        ref={videoRef}
        src={src}
        muted
        playsInline
        autoPlay
        preload="auto"
        onEnded={finish}
        onPlaying={() => setPlaying(true)}
        onProgress={(event) => {
          // How much of the file has arrived. With a quarter-gigabyte trailer
          // this is the difference between "loading" and "broken".
          const video = event.currentTarget;
          if (video.buffered.length === 0 || !Number.isFinite(video.duration)) return;
          setBuffered(video.buffered.end(video.buffered.length - 1) / video.duration);
        }}
        onError={() => {
          // A missing or unplayable trailer must never be fatal: fall back to
          // the short clip, and if that fails too, go straight to the game.
          if (src !== BOOT_VIDEO) setSrc(BOOT_VIDEO);
          else finish();
        }}
        className="h-full w-full object-cover"
      />

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_45%,rgb(12_10_9_/_0.45))]" />

      <div className="absolute bottom-8 left-1/2 flex w-[min(26rem,80vw)] -translate-x-1/2 flex-col items-center gap-3.5">
        <span className="text-[1.15rem] font-light tracking-[0.5em] text-bone">KRYONIS</span>

        {/* Buffering, shown only while it is still a question. */}
        {!playing || buffered < 0.995 ? (
          <span className="flex w-full flex-col items-center gap-2">
            <span className="h-px w-full overflow-hidden bg-white/12">
              {buffered > 0 ? (
                <span
                  className="block h-px bg-dust transition-[width] duration-500"
                  style={{ width: `${Math.min(100, buffered * 100)}%` }}
                />
              ) : (
                <span className="block h-px w-1/3 animate-[slide-in-left_1.6s_ease-in-out_infinite] bg-dust" />
              )}
            </span>
            <span className="t-micro">
              {blocked
                ? 'Playback blocked — press Skip'
                : isTrailer
                  ? 'Loading trailer · the colony is being prepared behind it'
                  : 'Preparing the colony'}
            </span>
          </span>
        ) : null}

        {/*
          Available immediately. Making a player wait 1.8 s to be allowed to skip
          a video they have already decided not to watch is a small cruelty.
        */}
        <button
          type="button"
          onClick={finish}
          autoFocus
          className="press glass pointer-events-auto rounded-[3px] px-5 py-2.5 text-titanium hover:text-bone"
        >
          <span className="t-micro">{isTrailer ? 'Skip intro' : 'Enter colony'}</span>
        </button>
      </div>
    </div>
  );
}
