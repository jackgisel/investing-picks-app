"use client";

import { useState, useEffect } from "react";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("tli-cookie-consent");
    if (!consent) {
      setVisible(true);
    }
  }, []);

  const handleConsent = (accepted: boolean) => {
    localStorage.setItem(
      "tli-cookie-consent",
      JSON.stringify({ accepted, timestamp: new Date().toISOString() })
    );
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-bg-secondary border-t border-border px-7 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 z-[100]">
      <p className="font-sans text-[12px] text-text-muted">
        We use cookies to improve your experience.{" "}
        <a
          href="/privacy"
          className="text-accent-green hover:underline"
        >
          Privacy Policy
        </a>
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => handleConsent(false)}
          className="font-mono text-[11px] px-4 py-2 border border-border bg-transparent text-text cursor-pointer tracking-wider hover:bg-bg-tertiary transition-colors"
        >
          Decline
        </button>
        <button
          onClick={() => handleConsent(true)}
          className="font-mono text-[11px] px-4 py-2 bg-accent-green text-black border-accent-green cursor-pointer tracking-wider font-semibold hover:bg-accent-green-hover transition-colors"
        >
          Accept
        </button>
      </div>
    </div>
  );
}
