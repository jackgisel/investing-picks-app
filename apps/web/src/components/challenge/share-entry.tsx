"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";

/** Copy link and post to X. The text says what happened, not what to buy. */
export function ShareEntry({ url, text }: { url: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const intent = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        className="btn-outline"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
          } catch {
            /* clipboard blocked; the URL is in the address bar */
          }
        }}
      >
        {copied ? <Check size={14} aria-hidden /> : <Link2 size={14} aria-hidden />}
        {copied ? "Copied" : "Copy link"}
      </button>
      <a href={intent} target="_blank" rel="noopener noreferrer" className="btn-outline">
        Post on X
      </a>
    </div>
  );
}
