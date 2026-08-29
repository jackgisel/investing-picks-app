/**
 * The composition: lays every scene out as a `<Sequence>` sized by
 * `buildTimeline` (`timeline.ts`), plays each scene's own `<Audio>` when one
 * exists, and dispatches each scene's `SlideSpec` to the matching slide
 * component. See DESIGN.md, "Timeline" / "What to build".
 */

import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import "./fonts";
import { COLORS, VIDEO } from "../theme";
import type { DeckProps, Pack, Scene } from "../types";
import { BulletsSlide } from "./slides/Bullets";
import { EventsSlide } from "./slides/Events";
import { HoldingsSlide } from "./slides/Holdings";
import { OutroSlide } from "./slides/Outro";
import { PeriodBarsSlide } from "./slides/PeriodBars";
import { PicksChartSlide } from "./slides/PicksChart";
import { QuoteSlide } from "./slides/Quote";
import { SectorsSlide } from "./slides/Sectors";
import { StatSlide } from "./slides/Stat";
import { TitleSlide } from "./slides/Title";
import { WatchlistSlide } from "./slides/Watchlist";
import { buildTimeline } from "./timeline";

function SceneSlide({ scene, pack }: { scene: Scene; pack: Pack }) {
  const { slide, chapter, accent } = scene;
  switch (slide.type) {
    case "title":
      return <TitleSlide chapter={chapter} accent={accent} title={slide.title} subtitle={slide.subtitle} periodLabel={slide.periodLabel} />;
    case "stat":
      return <StatSlide chapter={chapter} accent={accent} heading={slide.heading} stats={slide.stats} />;
    case "picksChart":
      return (
        <PicksChartSlide
          chapter={chapter}
          accent={accent}
          heading={slide.heading}
          caption={slide.caption}
          chart={pack.facts.chart}
        />
      );
    case "periodBars":
      return (
        <PeriodBarsSlide
          chapter={chapter}
          accent={accent}
          heading={slide.heading}
          caption={slide.caption}
          periods={pack.facts.periods}
        />
      );
    case "holdings":
      return (
        <HoldingsSlide
          chapter={chapter}
          accent={accent}
          heading={slide.heading}
          caption={slide.caption}
          holdings={pack.facts.holdings}
          limit={slide.limit}
        />
      );
    case "sectors":
      return (
        <SectorsSlide
          chapter={chapter}
          accent={accent}
          heading={slide.heading}
          caption={slide.caption}
          sectors={pack.facts.sectorBreadth.map((sector) => ({
            sector: `${sector.sector}${sector.highRatingChange === null ? "" : ` (${sector.highRatingChange >= 0 ? "+" : ""}${sector.highRatingChange})`}`,
            count: sector.qualifiedCompanies,
            sharePct: sector.qualifiedSharePct,
          }))}
        />
      );
    case "watchlist":
      return <WatchlistSlide chapter={chapter} accent={accent} heading={slide.heading} ticker={slide.ticker} caption={slide.caption} facts={pack.facts} />;
    case "events":
      return <EventsSlide chapter={chapter} accent={accent} heading={slide.heading} items={slide.items} />;
    case "bullets":
      return <BulletsSlide chapter={chapter} accent={accent} heading={slide.heading} items={slide.items} />;
    case "quote":
      return <QuoteSlide chapter={chapter} accent={accent} text={slide.text} attribution={slide.attribution} />;
    case "outro":
      return <OutroSlide chapter={chapter} accent={accent} heading={slide.heading} lines={slide.lines} />;
    default: {
      // Exhaustiveness check: a new SlideSpec variant fails the build here
      // instead of silently rendering nothing.
      const exhaustive: never = slide;
      return exhaustive;
    }
  }
}

export function Deck({ pack, script, audio }: DeckProps) {
  const timeline = buildTimeline(script, audio, VIDEO.fps);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      {script.scenes.map((scene, i) => {
        const timing = timeline[i]!;
        return (
          <Sequence key={scene.id} from={timing.startFrame} durationInFrames={timing.durationInFrames} name={scene.id}>
            <SceneSlide scene={scene} pack={pack} />
            {timing.audioFile && <Audio src={staticFile(timing.audioFile)} />}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
