import { COLORS } from "../../theme";
import type { AccentName, PackFacts } from "../../types";
import { SlideFrame } from "../components/SlideFrame";
import { STAGGER_FRAMES, useEnter } from "../motion";

function WatchRow({ item, index }: { item: PackFacts["watchlist"][number]; index: number }) {
  const enter = useEnter(10 + index * STAGGER_FRAMES * 5);
  const change = item.ratingChange === null ? "No 7-day comparison" : `${item.ratingChange >= 0 ? "+" : ""}${item.ratingChange.toFixed(2)} in 7d`;
  return <div style={{ opacity: enter.opacity, transform: enter.transform, borderTop: `1px solid ${COLORS.border}`, padding: "28px 0", display: "grid", gridTemplateColumns: "140px 1fr 260px", gap: 28, alignItems: "center" }}><div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 38, fontWeight: 700, color: COLORS.text }}>{item.ticker}</div><div><div style={{ fontFamily: "Outfit", fontSize: 26, color: COLORS.text }}>{item.name ?? "Company name unavailable"}</div><div style={{ fontFamily: "Outfit", fontSize: 17, color: COLORS.textDim, marginTop: 6 }}>{item.sector ?? "Sector unavailable"}</div></div><div style={{ textAlign: "right" }}><div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 32, color: COLORS.mint }}>{item.quantRating.toFixed(2)} / 5</div><div style={{ fontFamily: "Outfit", fontSize: 16, color: COLORS.textDim, marginTop: 6 }}>{change}</div></div></div>;
}

export function WatchlistSlide({ chapter, accent, heading, caption, facts }: { chapter: string; accent: AccentName; heading: string; caption?: string; facts: PackFacts }) {
  const headingEnter = useEnter(0);
  return <SlideFrame chapter={chapter} accent={accent}><div style={{ opacity: headingEnter.opacity, transform: headingEnter.transform }}><h2 style={{ fontFamily: "Outfit", fontSize: 44, fontWeight: 700, color: COLORS.text, margin: 0 }}>{heading}</h2><p style={{ fontFamily: "Outfit", fontSize: 18, color: COLORS.textMuted, margin: "10px 0 0" }}>{caption ?? "Highest-rated companies outside the current book. Not picks."}</p></div><div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", marginTop: 30 }}>{facts.watchlist.map((item, index) => <WatchRow key={item.ticker} item={item} index={index} />)}</div>{facts.watchlistAsOf && <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 15, color: COLORS.textDim }}>Ratings as of {facts.watchlistAsOf}. A rating does not mean a buy.</div>}</SlideFrame>;
}
