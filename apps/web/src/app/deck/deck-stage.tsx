"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Fixed 1600×900 design surface, uniformly scaled to fit the viewport.
 *
 * Recording is the whole point of this route, so the frame must be exactly 16:9
 * no matter what shape the browser window is — otherwise every slide reflows
 * between takes and text lands in a different place each time. Scaling one
 * fixed-size stage keeps type, spacing, and line breaks identical at any window
 * size, which is what makes the recording reproducible.
 */
export const STAGE_W = 1600;
export const STAGE_H = 900;

export function DeckStage({
  slides,
  index,
  onIndexChange,
}: {
  slides: React.ReactNode[];
  index: number;
  onIndexChange: (next: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [chromeVisible, setChromeVisible] = useState(true);

  const count = slides.length;

  const go = useCallback(
    (delta: number) => {
      onIndexChange(Math.min(count - 1, Math.max(0, index + delta)));
    },
    [count, index, onIndexChange]
  );

  // Measure with a layout effect so the first painted frame is already scaled —
  // a visible jump from 1:1 to fitted would land in the recording.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const fit = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      setScale(Math.min(width / STAGE_W, height / STAGE_H));
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
        case "PageDown":
        case " ":
          e.preventDefault();
          go(1);
          break;
        case "ArrowLeft":
        case "ArrowUp":
        case "PageUp":
          e.preventDefault();
          go(-1);
          break;
        case "Home":
          e.preventDefault();
          onIndexChange(0);
          break;
        case "End":
          e.preventDefault();
          onIndexChange(count - 1);
          break;
        case "h":
          // Hide the counter and hints before hitting record.
          setChromeVisible((v) => !v);
          break;
        case "f":
          if (document.fullscreenElement) void document.exitFullscreen();
          else void document.documentElement.requestFullscreen();
          break;
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onIndexChange, count]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div ref={containerRef} className="flex-1 min-h-0 grid place-items-center">
        <div
          style={{
            width: STAGE_W,
            height: STAGE_H,
            transform: `scale(${scale})`,
            transformOrigin: "center center",
          }}
          className="relative shrink-0 overflow-hidden bg-bg text-text"
        >
          {slides[index]}
        </div>
      </div>

      {chromeVisible && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 rounded-pill border border-white/15 bg-black/70 px-5 py-2 backdrop-blur">
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={index === 0}
            className="font-mono text-[13px] text-white/70 hover:text-white disabled:opacity-30"
          >
            ←
          </button>
          <span className="font-mono text-[12px] text-white/60 tabular-nums">
            {index + 1} / {count}
          </span>
          <button
            type="button"
            onClick={() => go(1)}
            disabled={index === count - 1}
            className="font-mono text-[13px] text-white/70 hover:text-white disabled:opacity-30"
          >
            →
          </button>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/35 border-l border-white/15 pl-4">
            h hide · f full
          </span>
        </div>
      )}
    </div>
  );
}
