"use client";

import Image from "next/image";
import { useState } from "react";

import { cn } from "@/lib/utils";

const SIZE_STYLES = {
  xxs: { frame: "h-4 w-4 rounded-[4px]", pixels: 16, text: "text-[5px]" },
  xs: { frame: "h-5 w-5 rounded-[5px]", pixels: 20, text: "text-[6px]" },
  sm: { frame: "h-[26px] w-[26px] rounded-[6px]", pixels: 26, text: "text-[7px]" },
  md: { frame: "h-9 w-9 rounded-[9px]", pixels: 36, text: "text-[8px]" },
  lg: { frame: "h-11 w-11 rounded-[11px]", pixels: 44, text: "text-[9px]" },
} as const;

export type CompanyLogoSize = keyof typeof SIZE_STYLES;

/**
 * Official company domains for names that appear in the live portfolio or in
 * the public backtest. Their favicons are square brand marks rather than wide
 * wordmarks, which keeps small table logos legible instead of clipping text.
 */
const COMPANY_DOMAINS: Readonly<Record<string, string>> = {
  AEM: "agnicoeagle.com",
  AGI: "alamosgold.com",
  ASIC: "investors.ategrity.com",
  ATLC: "atlanticus.com",
  AVGO: "broadcom.com",
  BMA: "macro.com.ar",
  CPRX: "catalystpharma.com",
  CRS: "carpentertechnology.com",
  FIX: "comfortsystemsusa.com",
  IAG: "iamgold.com",
  IRS: "irsa.com.ar",
  NUTX: "nutexhealth.com",
  NVDA: "nvidia.com",
  ORLA: "orlamining.com",
  ROKU: "roku.com",
  SEZL: "sezzle.com",
  SKWD: "skywardinsurance.com",
  SOFI: "sofi.com",
  STX: "seagate.com",
  TGS: "tgs.com.ar",
  TKC: "turkcell.com.tr",
  WDC: "westerndigital.com",
  WT: "wisdomtree.com",
  YPF: "ypf.com",
};

function officialMarkUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(
    `https://${domain}`,
  )}&sz=128`;
}

/**
 * The best available source for a ticker. Known portfolio names use the mark
 * published by the company's own site; everything else starts with a 256px,
 * transparent symbol asset.
 */
export function companyLogoUrl(ticker: string): string {
  const normalized = ticker.trim().toUpperCase();
  const domain = COMPANY_DOMAINS[normalized];
  return domain
    ? officialMarkUrl(domain)
    : `https://companiesmarketcap.com/img/company-logos/256/${encodeURIComponent(
        normalized,
      )}.png`;
}

function fallbackLogoUrl(ticker: string): string {
  return `https://images.financialmodelingprep.com/symbol/${encodeURIComponent(
    ticker,
  )}.png`;
}

function logoSources(ticker: string): string[] {
  const domain = COMPANY_DOMAINS[ticker];
  return [
    ...(domain ? [officialMarkUrl(domain)] : []),
    `https://companiesmarketcap.com/img/company-logos/256/${encodeURIComponent(
      ticker,
    )}.png`,
    fallbackLogoUrl(ticker),
  ];
}

/**
 * A fixed-size company mark with a ticker fallback.
 *
 * Logos are decorative wherever this is used because the adjacent ticker is
 * the accessible name. The ticker fallback appears only after every image
 * source fails so it cannot bleed through transparent company marks.
 */
export function CompanyLogo({
  ticker,
  size = "sm",
  className,
  priority = false,
}: {
  ticker: string | null | undefined;
  size?: CompanyLogoSize;
  className?: string;
  priority?: boolean;
}) {
  const normalized = ticker?.trim().toUpperCase() ?? "";
  const [sourceState, setSourceState] = useState({ ticker: "", index: 0 });
  const sourceIndex = sourceState.ticker === normalized ? sourceState.index : 0;
  const sources = normalized ? logoSources(normalized) : [];
  const failed = !normalized || sourceIndex >= sources.length;
  const styles = SIZE_STYLES[size];

  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-grid shrink-0 place-items-center overflow-hidden",
        failed && "bg-bg-tertiary ring-1 ring-inset ring-border",
        styles.frame,
        className,
      )}
    >
      {failed ? (
        <span
          className={cn(
            "font-mono font-bold tracking-[-0.04em] text-[#686c73]",
            styles.text,
          )}
        >
          {normalized.slice(0, 2) || "—"}
        </span>
      ) : null}
      {!failed ? (
        <Image
          key={`${normalized}-${sourceIndex}`}
          src={sources[sourceIndex]}
          alt=""
          width={styles.pixels}
          height={styles.pixels}
          sizes={`${styles.pixels}px`}
          className="absolute inset-0 h-full w-full object-contain"
          draggable={false}
          priority={priority}
          referrerPolicy="no-referrer"
          unoptimized
          onError={() =>
            setSourceState({ ticker: normalized, index: sourceIndex + 1 })
          }
        />
      ) : null}
    </span>
  );
}
