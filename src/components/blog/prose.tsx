import Link from "next/link";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Prose primitives for blog articles. Each component renders styled output
 * matching Outpick's IBM Plex Sans/Mono dark aesthetic. Compose freely.
 */

export function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="font-sans text-[15px] text-text-muted leading-[1.75] max-w-[680px] [&>*+*]:mt-5">
      {children}
    </div>
  );
}

export function H2({
  id,
  children,
}: {
  id?: string;
  children: ReactNode;
}) {
  return (
    <h2
      id={id}
      className="font-sans text-[24px] font-bold tracking-tight text-text mt-14 mb-4 scroll-mt-24"
    >
      {children}
    </h2>
  );
}

export function H3({
  id,
  children,
}: {
  id?: string;
  children: ReactNode;
}) {
  return (
    <h3
      id={id}
      className="font-sans text-[18px] font-semibold tracking-tight text-text mt-9 mb-3 scroll-mt-24"
    >
      {children}
    </h3>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p className="font-sans text-[15px] text-text-muted leading-[1.75]">{children}</p>;
}

export function UL({ children }: { children: ReactNode }) {
  return (
    <ul className="font-sans text-[15px] text-text-muted leading-[1.75] space-y-2 list-none pl-0">
      {children}
    </ul>
  );
}

export function OL({ children }: { children: ReactNode }) {
  return (
    <ol className="font-sans text-[15px] text-text-muted leading-[1.75] space-y-2 list-decimal pl-5 marker:text-accent-green marker:font-mono marker:text-[13px]">
      {children}
    </ol>
  );
}

export function LI({ children }: { children: ReactNode }) {
  return (
    <li className="relative pl-5 before:content-['+'] before:absolute before:left-0 before:top-0 before:font-mono before:text-accent-green before:font-bold">
      <span>{children}</span>
    </li>
  );
}

export function Strong({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-text">{children}</strong>;
}

export function A({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  const isInternal = href.startsWith("/") || href.startsWith("#");
  const className =
    "text-accent-green underline decoration-accent-green/30 underline-offset-4 hover:decoration-accent-green transition-colors";
  if (isInternal) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {children}
    </a>
  );
}

export function Lede({ children }: { children: ReactNode }) {
  return (
    <p className="font-sans text-[18px] text-text leading-[1.6] mb-12 max-w-[680px]">
      {children}
    </p>
  );
}

export function Callout({
  variant = "info",
  title,
  children,
}: {
  variant?: "info" | "success" | "warning";
  title?: string;
  children: ReactNode;
}) {
  const styles: Record<string, string> = {
    info: "border-l-2 border-accent-purple bg-accent-purple-soft/20",
    success: "border-l-2 border-accent-green bg-accent-green-soft/20",
    warning: "border-l-2 border-accent-red bg-accent-red-soft/20",
  };
  const labelColor: Record<string, string> = {
    info: "text-accent-purple",
    success: "text-accent-green",
    warning: "text-accent-red",
  };
  return (
    <aside
      className={cn(
        "px-6 py-5 my-8 max-w-[680px]",
        styles[variant],
      )}
    >
      {title ? (
        <p
          className={cn(
            "font-mono text-[10px] tracking-[2px] font-bold uppercase mb-2",
            labelColor[variant],
          )}
        >
          {title}
        </p>
      ) : null}
      <div className="font-sans text-[14px] text-text-muted leading-[1.7]">
        {children}
      </div>
    </aside>
  );
}

export function KeyTakeaway({ children }: { children: ReactNode }) {
  return (
    <Callout variant="success" title="Key Takeaway">
      {children}
    </Callout>
  );
}

export function StatGrid({
  stats,
}: {
  stats: { label: string; value: string; green?: boolean }[];
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-0.5 bg-border my-10 max-w-[680px]">
      {stats.map((s) => (
        <div key={s.label} className="bg-bg-secondary py-5 px-5">
          <p className="font-mono text-[9px] text-text-dim tracking-[1.5px] mb-2">
            {s.label}
          </p>
          <p
            className={cn(
              "font-mono text-[20px] font-bold",
              s.green ? "text-accent-green" : "text-text",
            )}
          >
            {s.value}
          </p>
        </div>
      ))}
    </div>
  );
}

export function CompareTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | ReactNode)[][];
}) {
  return (
    <div className="my-10 max-w-[680px] border border-border bg-bg-secondary overflow-x-auto">
      <table className="w-full text-left">
        <thead className="border-b border-border">
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                className="font-mono text-[10px] text-text-dim tracking-[1.5px] uppercase px-5 py-3 font-semibold"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              className={ri < rows.length - 1 ? "border-b border-border" : ""}
            >
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="font-sans text-[13px] text-text-muted px-5 py-3.5"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Quote({
  children,
  cite,
}: {
  children: ReactNode;
  cite?: string;
}) {
  return (
    <blockquote className="my-10 max-w-[680px] border-l-2 border-accent-green pl-6 py-1">
      <p className="font-serif text-[19px] text-text leading-[1.55] italic">
        {children}
      </p>
      {cite ? (
        <footer className="font-mono text-[11px] text-text-dim tracking-wider mt-3 uppercase">
          — {cite}
        </footer>
      ) : null}
    </blockquote>
  );
}

export function InlineCTA({
  heading = "Want to see the picks?",
  body = "Outpick publishes a new high-conviction stock pick every two weeks, with the full thesis and live tracking. $1,000 / year — cancel anytime.",
  cta = "START YOUR MEMBERSHIP",
  href = "/dashboard",
}: {
  heading?: string;
  body?: string;
  cta?: string;
  href?: string;
}) {
  return (
    <div className="my-12 bg-bg-secondary border border-border px-8 py-9 max-w-[680px]">
      <p className="font-mono text-[10px] text-accent-green tracking-[2px] mb-3 uppercase">
        OUTPICK MEMBERSHIP
      </p>
      <h3 className="font-sans text-[20px] font-bold tracking-tight mb-2.5 text-text">
        {heading}
      </h3>
      <p className="font-sans text-[14px] text-text-muted leading-relaxed mb-6 max-w-[520px]">
        {body}
      </p>
      <Link href={href} className="btn-primary">
        {cta} →
      </Link>
    </div>
  );
}

export function FAQList({
  items,
}: {
  items: { q: string; a: ReactNode }[];
}) {
  return (
    <div className="my-12 max-w-[680px]">
      <h2 className="font-sans text-[24px] font-bold tracking-tight text-text mb-6">
        Frequently asked questions
      </h2>
      <div className="border-t border-border">
        {items.map((item, i) => (
          <details
            key={i}
            className="group border-b border-border py-5"
          >
            <summary className="font-sans text-[15px] font-semibold text-text cursor-pointer list-none flex items-start justify-between gap-4 group-hover:text-accent-green transition-colors">
              <span>{item.q}</span>
              <span className="font-mono text-accent-green text-[18px] leading-none transition-transform group-open:rotate-45 shrink-0 mt-0.5">
                +
              </span>
            </summary>
            <div className="font-sans text-[14px] text-text-muted leading-[1.7] mt-3 pr-8">
              {item.a}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

export function TLDR({ children }: { children: ReactNode }) {
  return (
    <div className="my-10 max-w-[680px] border border-border bg-bg-secondary px-7 py-6">
      <p className="font-mono text-[10px] text-accent-green tracking-[2px] mb-3 uppercase">
        TL;DR
      </p>
      <div className="font-sans text-[14px] text-text-muted leading-[1.7] [&>p+p]:mt-3">
        {children}
      </div>
    </div>
  );
}
