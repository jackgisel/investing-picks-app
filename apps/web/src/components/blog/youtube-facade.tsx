"use client";

import { useState } from "react";
import { preconnect } from "react-dom";

const THUMB_BASE = "https://i.ytimg.com/vi/";

/**
 * Click-to-load stand-in for a YouTube iframe.
 *
 * The real embed costs ~1MB of player script plus its own fonts and CSS on
 * every article view, whether or not anyone presses play — on the featured
 * post it was half the page weight. Until the first click this is one poster
 * JPEG and a button; the click swaps in the iframe with autoplay, so playback
 * still takes the one tap it always did.
 *
 * Hovering or focusing the poster opens the connections the player will need
 * so the swap feels immediate.
 */
export function YouTubeFacade({
  videoId,
  title,
  embedUrl,
}: {
  videoId: string;
  title: string;
  embedUrl: string;
}) {
  const [playing, setPlaying] = useState(false);
  // maxresdefault only exists for uploads with an HD rendition; fall back to
  // the always-present 480px poster when it 404s.
  const [hd, setHd] = useState(true);

  if (playing) {
    return (
      <iframe
        className="absolute inset-0 h-full w-full"
        src={`${embedUrl}?autoplay=1`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    );
  }

  const warm = () => {
    preconnect("https://www.youtube-nocookie.com");
    preconnect("https://www.google.com");
  };

  const poster = `${THUMB_BASE}${videoId}/hqdefault.jpg`;
  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      onPointerEnter={warm}
      onFocus={warm}
      aria-label={`Play video: ${title}`}
      className="group absolute inset-0 h-full w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
    >
      <img
        src={poster}
        srcSet={
          hd
            ? `${poster} 480w, ${THUMB_BASE}${videoId}/maxresdefault.jpg 1280w`
            : undefined
        }
        sizes="(max-width: 680px) 100vw, 680px"
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setHd(false)}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <span
        aria-hidden
        className="absolute left-1/2 top-1/2 flex h-12 w-[68px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[14px] bg-[#f00] text-white opacity-90 transition-opacity group-hover:opacity-100"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
          <path d="M8 5.5v13l11-6.5z" />
        </svg>
      </span>
    </button>
  );
}
