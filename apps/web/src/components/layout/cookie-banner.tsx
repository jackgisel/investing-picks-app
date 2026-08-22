"use client";

import { useEffect, useRef, useState } from "react";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const consent = localStorage.getItem("tli-cookie-consent");
    if (!consent) {
      setVisible(true);
    }
  }, []);

  useEffect(() => {
    if (!visible) {
      document.documentElement.classList.remove("cookie-banner-visible");
      document.documentElement.style.removeProperty("--cookie-banner-h");
      return;
    }

    const root = document.documentElement;
    root.classList.add("cookie-banner-visible");
    const el = bannerRef.current;
    if (!el) return;

    const apply = () => {
      root.style.setProperty("--cookie-banner-h", `${el.offsetHeight}px`);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.classList.remove("cookie-banner-visible");
      root.style.removeProperty("--cookie-banner-h");
    };
  }, [visible]);

  const handleConsent = (accepted: boolean) => {
    localStorage.setItem(
      "tli-cookie-consent",
      JSON.stringify({ accepted, timestamp: new Date().toISOString() }),
    );
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      ref={bannerRef}
      className="fixed bottom-0 left-0 right-0 z-[100] flex flex-col items-center justify-between gap-3 border-t border-border bg-bg px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_-8px_30px_rgba(0,0,0,0.5)] sm:flex-row"
    >
      <p className="font-sans text-[13px] text-text-muted">
        We use cookies to improve your experience.{" "}
        <a
          href="/privacy"
          className="text-text font-semibold underline underline-offset-2"
        >
          Privacy Policy
        </a>
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => handleConsent(false)}
          className="pill-outline !text-[11px]"
        >
          Decline
        </button>
        <button
          onClick={() => handleConsent(true)}
          className="pill-solid !text-[11px]"
        >
          Accept
        </button>
      </div>
    </div>
  );
}
