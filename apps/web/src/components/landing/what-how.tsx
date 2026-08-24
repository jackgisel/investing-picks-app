import Link from "next/link";
import { PillButton } from "@/components/ui/pill-button";
import { HScroll } from "@/components/ui/h-scroll";
import {
  ResearchDiagram,
  PublishDiagram,
  TrackDiagram,
  MeasureDiagram,
} from "./how-it-works-diagrams";
import type { ComponentType } from "react";

const STEPS: {
  n: string;
  tag: string;
  title: string;
  body: string;
  Diagram: ComponentType;
}[] = [
  {
    n: "01",
    tag: "Research",
    title: "Score the universe, publish one name",
    body: "Fundamentals, revisions, and sector-relative context across ~3,600 US-listed stocks. One high-conviction business clears the bar every two weeks.",
    Diagram: ResearchDiagram,
  },
  {
    n: "02",
    tag: "Publish",
    title: "Full thesis, not a ticker alert",
    body: "Each note covers the business case, the figures behind it, the risks, and what would have to be true for us to be wrong. You read the research, then decide.",
    Diagram: PublishDiagram,
  },
  {
    n: "03",
    tag: "Hold",
    title: "Underwritten over years, not quarters",
    body: "A position is held while the reasons for owning it hold. Most of what the price does in between is noise we are deliberately not reacting to.",
    Diagram: TrackDiagram,
  },
  {
    n: "04",
    tag: "Close",
    title: "We tell you when we sell, and why",
    body: "Every closed position gets an exit note: what changed, the rule that closed it, and what the round trip returned. The losers get the same write-up as the winners.",
    Diagram: MeasureDiagram,
  },
];

function StepVisual({ Diagram }: { Diagram: ComponentType }) {
  return (
    <div className="relative min-h-[200px] sm:min-h-[220px] lg:min-h-[240px]">
      <Diagram />
    </div>
  );
}

/**
 * How the research loop works, end to end.
 *
 * Used to carry a negative top margin and a transparent-to-bg gradient so the
 * hero's moon art could bleed into it. Two sections now sit between it and the
 * hero, so that margin was pulling this up over the live-picks border instead.
 *
 * Step 04 used to be "Measure" and pointed at the walk-forward model. It is now
 * the exit note, which is the part of the loop members actually experience and
 * the part most publications never show.
 */
export function WhatHow() {
  return (
    <section
      id="what-how"
      className="relative overflow-hidden border-b border-border bg-bg"
    >
      <div className="container-op relative pb-16 pt-20 sm:pb-20 sm:pt-24 lg:pb-24 lg:pt-28">
        <div className="mb-10 max-w-[560px] lg:mb-14">
          <p className="section-label">How Outpick works</p>
          <h2 className="section-title text-[30px] sm:text-[34px]">
            Research on a schedule. A live book you can audit.
          </h2>
          <p className="section-sub mb-0">
            A fixed cadence of stock research, an example portfolio run in the
            open, and a written note every time a position opens or closes.
          </p>
        </div>

        {/* Mobile: horizontal step cards */}
        <div className="lg:hidden">
          <HScroll innerClassName="gap-4 pb-1">
            {STEPS.map((step) => (
              <article
                key={step.n}
                className="flex w-[min(88vw,340px)] shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-bg"
              >
                <div className="border-b border-border px-4 py-3">
                  <div className="mb-2 flex items-center gap-2.5">
                    <span className="font-mono text-[11px] font-bold tracking-[0.1em] text-text-dim">
                      {step.n}
                    </span>
                    <span className="font-sans text-[10px] font-bold uppercase tracking-[0.12em] text-text-dim">
                      {step.tag}
                    </span>
                  </div>
                  <h3 className="font-sans text-[16px] font-bold leading-snug tracking-tight">
                    {step.title}
                  </h3>
                  <p className="mt-2 font-sans text-[13px] leading-relaxed text-text-muted">
                    {step.body}
                  </p>
                </div>
                <div className="min-h-[180px] p-3">
                  <step.Diagram />
                </div>
              </article>
            ))}
          </HScroll>
        </div>

        {/* Desktop: text + full-width panel per step */}
        <ol className="hidden lg:block">
          {STEPS.map((step, i) => (
            <li
              key={step.n}
              className={`grid grid-cols-2 items-stretch gap-10 border-t border-border py-10 xl:gap-14 ${
                i === 0 ? "border-t-0 pt-0" : ""
              }`}
            >
              <div className="flex flex-col justify-center border-l-2 border-border-strong pl-6">
                <div className="mb-3 flex items-center gap-3">
                  <span className="font-mono text-[12px] font-bold tracking-[0.12em] text-text-dim">
                    {step.n}
                  </span>
                  <span className="font-sans text-[11px] font-bold uppercase tracking-[0.12em] text-text-dim">
                    {step.tag}
                  </span>
                </div>
                <h3 className="font-sans text-[22px] font-bold leading-snug tracking-tight">
                  {step.title}
                </h3>
                <p className="mt-3 max-w-[400px] font-sans text-[15px] leading-relaxed text-text-muted">
                  {step.body}
                </p>
              </div>
              <StepVisual Diagram={step.Diagram} />
            </li>
          ))}
        </ol>

        <div className="mt-10 flex flex-wrap items-center gap-4 lg:mt-12">
          <PillButton href="/pricing" arrow>
            See membership
          </PillButton>
          <Link
            href="/#sample-research"
            className="rounded-sm font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2"
          >
            Read a sample note →
          </Link>
        </div>
      </div>
    </section>
  );
}
