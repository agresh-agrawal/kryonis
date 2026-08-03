'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const TRAILER_VIDEO = '/media/trailer.mp4';
const BOOT_VIDEO = '/media/kryonis-loading.mp4';
const MAX_BOOT_MS = 12000;
const MAX_TRAILER_MS = 3 * 60 * 1000;
const SEEN_KEY = 'kryonis:seenTrailer';

export function BootVideo({ onComplete }: { onComplete: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [canSkip, setCanSkip] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [firstRun] = useState(() => {
    try {
      return window.localStorage.getItem(SEEN_KEY) !== '1';
    } catch {
      return false;
    }
  });

  const [src, setSrc] = useState(() => {
    try {
      const seen = window.localStorage.getItem(SEEN_KEY) === '1';
      return seen ? BOOT_VIDEO : TRAILER_VIDEO;
    } catch {
      return BOOT_VIDEO;
    }
  });

  const finish = useCallback(() => {
    if (firstRun) {
      try {
        window.localStorage.setItem(SEEN_KEY, '1');
      } catch {
        // Ignore localStorage failures (private browsing, quota, etc.).
      }
    }
    onComplete();
  }, [firstRun, onComplete]);

  useEffect(() => {
    const timeout = window.setTimeout(
      finish,
      src === TRAILER_VIDEO ? MAX_TRAILER_MS : MAX_BOOT_MS,
    );
    const skipTimer = window.setTimeout(() => setCanSkip(true), 1800);
    const video = videoRef.current;

    video
      ?.play()
      .catch(() => {
        setBlocked(true);
        setCanSkip(true);
      });

    return () => {
      window.clearTimeout(timeout);
      window.clearTimeout(skipTimer);
    };
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
        onError={() => {
          if (src !== BOOT_VIDEO) setSrc(BOOT_VIDEO);
          else finish();
        }}
        className="h-full w-full object-cover"
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_45%,rgb(12_10_9_/_0.42))]" />

      <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-3">
        <span className="text-[1.15rem] font-light tracking-[0.5em] text-bone">KRYONIS</span>
        {blocked ? <span className="t-sm text-faint">Tap to begin playback</span> : null}
        {canSkip ? (
          <button
            type="button"
            onClick={finish}
            className="press glass pointer-events-auto rounded-[3px] px-4 py-2 text-titanium hover:text-bone"
          >
            <span className="t-micro">Enter colony</span>
          </button>
        ) : (
          <span className="h-px w-36 overflow-hidden bg-white/10">
            <span className="block h-px w-1/3 animate-[slide-in-left_1.6s_ease-in-out_infinite] bg-dust" />
          </span>
        )}
      </div>
    </div>
  );
}
