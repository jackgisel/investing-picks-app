import type { ComponentType } from "react";
import { Composition } from "remotion";
import { COLORS, VIDEO } from "../theme";
import packFixture from "../__fixtures__/pack.sample.json" with { type: "json" };
import scriptFixture from "./__fixtures__/script.sample.json" with { type: "json" };
import type { AudioManifest, DeckProps, Pack, Script } from "../types";
import { PicksBenchmarkChart } from "./charts/PicksBenchmarkChart";
import { Deck } from "./Deck";
import { buildTimeline, totalDurationInFrames } from "./timeline";

// `Composition`'s `Props` generic requires `Record<string, unknown>`, which
// the pipeline's hand-authored `DeckProps` interface (deliberately not
// index-signatured — see src/types.ts) doesn't structurally satisfy. The
// cast is confined to this file; `Deck` itself keeps its real prop type
// everywhere else it's used (rendering, tests).
const DeckComponent = Deck as unknown as ComponentType<Record<string, unknown>>;

const pack = packFixture as unknown as Pack;
const script = scriptFixture as unknown as Script;

/**
 * No `voice` run has to exist for `pnpm studio` to work (DESIGN.md's render
 * stage explicitly supports a silent preview) — an audio manifest with no
 * scenes makes `buildTimeline` fall back to a word-count estimate for every
 * scene, so the fixture composition never needs a real mp3 on disk.
 */
const silentAudio: AudioManifest = {
  schemaVersion: 1,
  episodeId: pack.episodeId,
  voiceId: "",
  model: "",
  scenes: [],
  totalDurationSec: 0,
};

const deckFixtureProps: DeckProps = { pack, script, audio: silentAudio };

function ChartProbe() {
  return (
    <div
      style={{
        width: VIDEO.width,
        height: VIDEO.height,
        background: COLORS.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <PicksBenchmarkChart chart={pack.facts.chart} progress={0.6} width={1500} height={560} />
    </div>
  );
}

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="Deck"
        component={DeckComponent}
        durationInFrames={totalDurationInFrames(buildTimeline(script, silentAudio, VIDEO.fps))}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
        defaultProps={deckFixtureProps as unknown as Record<string, unknown>}
        calculateMetadata={async ({ props }) => {
          const deckProps = props as unknown as DeckProps;
          return {
            durationInFrames: totalDurationInFrames(buildTimeline(deckProps.script, deckProps.audio, VIDEO.fps)),
          };
        }}
      />
      <Composition
        id="ChartProbe"
        component={ChartProbe}
        durationInFrames={60}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
      />
    </>
  );
};
