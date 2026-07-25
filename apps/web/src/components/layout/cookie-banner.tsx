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
    <div className="fixed bottom-0 left-0 right-0 bg-bg border-t border-border px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 z-[100] shadow-[0_-8px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_-8px_30px_rgba(0,0,0,0.5)]">
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
