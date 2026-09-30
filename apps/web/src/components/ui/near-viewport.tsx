"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Renders `children` only once the wrapper is within `rootMargin` of the
 * viewport. Nothing is emitted for them in the server HTML.
 *
 * Exists because `loading="lazy"` is not lazy enough for the blog grid: Chrome
 * starts lazy images up to 1250px below the fold on 4G, so /blog kicked off
 * seven or eight thumbnail downloads alongside the masthead LCP image, and
 * Lighthouse (like a real 4G phone) charged them to LCP. One viewport ahead is
 * still early enough that a thumbnail is normally decoded before it scrolls in.
 */
export function NearViewport({
  children,
  className = "",
  rootMargin = "100% 0px",
}: {
  children: ReactNode;
  className?: string;
  rootMargin?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (near || !el) return;
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [near, rootMargin]);

  return (
    <div ref={ref} className={className}>
      {near ? children : null}
    </div>
  );
}
