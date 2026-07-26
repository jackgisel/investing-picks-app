"use client";

import { useMemo, useState } from "react";
import { DeckStage } from "./deck-stage";
import {
  CoverSlide,
  ScoreboardSlide,
  ChartSlide,
  HoldingsSlide,
  WinnersLaggardsSlide,
  TradesSlide,
  ResearchSlide,
  OutroSlide,
} from "./slides";
import { useStrategy } from "@/lib/hooks/use-strategy";
import { useChart, buildPicksComparison } from "@/lib/hooks/use-chart";
import { useTrades } from "@/lib/hooks/use-trades";
import { INSIGHT_INDEX } from "@/lib/insight-index";
import { computePortfolioReturnPct } from "@/lib/portfolio";

/** Positions per holdings slide — two columns of seven fills the frame. */
const HOLDINGS_PER_SLIDE = 14;
const MAX_TRADES = 8;
const MAX_RESEARCH_SLIDES = 4;

export default function DeckPage() {
  const [index, setIndex] = useState(0);

  const { data: strategy } = useStrategy();
  const { data: chart } = useChart();
  const { data: tradesData } = useTrades(MAX_TRADES);

  const comparison = useMemo(() => buildPicksComparison(chart), [chart]);

  const reviewDate = useMemo(
    () =>
      new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    []
  );

  const slides = useMemo(() => {
    const holdings = strategy?.holdings ?? [];
    const portfolio = strategy?.portfolio;

    // Cumulative return on capital deployed into picks is the headline the rest
    // of the site leads with, so the deck must not quietly use a different one.
    const picksReturnPct = computePortfolioReturnPct(strategy);

    const holdingPages: typeof holdings[] = [];
    for (let i = 0; i < holdings.length; i += HOLDINGS_PER_SLIDE) {
      holdingPages.push(holdings.slice(i, i + HOLDINGS_PER_SLIDE));
    }

    const research = INSIGHT_INDEX.filter(
      (i) => i.postType === "pick",
    ).slice(0, MAX_RESEARCH_SLIDES);

    return [
      <CoverSlide key="cover" reviewDate={reviewDate} />,
      <ScoreboardSlide
        key="scoreboard"
        picksReturnPct={picksReturnPct}
        comparison={comparison}
        positionCount={portfolio?.position_count ?? null}
        closedCount={portfolio?.picks?.closed_count ?? null}
      />,
      <ChartSlide key="chart" comparison={comparison} />,
      ...holdingPages.map((page, i) => (
        <HoldingsSlide
          key={`holdings-${i}`}
          holdings={page}
          page={i + 1}
          pageCount={holdingPages.length}
        />
      )),
      ...(holdings.length >= 4
        ? [<WinnersLaggardsSlide key="winners" holdings={holdings} />]
        : []),
      <TradesSlide key="trades" trades={tradesData?.trades ?? []} />,
      ...research.map((insight) => (
        <ResearchSlide key={insight.slug} insight={insight} />
      )),
      <OutroSlide key="outro" />,
    ];
  }, [strategy, comparison, tradesData, reviewDate]);

  // Data arriving can shorten the deck (e.g. the winners slide drops out), so
  // clamp rather than letting the stage index past the end and render blank.
  const safeIndex = Math.min(index, slides.length - 1);

  return (
    <DeckStage slides={slides} index={safeIndex} onIndexChange={setIndex} />
  );
}
