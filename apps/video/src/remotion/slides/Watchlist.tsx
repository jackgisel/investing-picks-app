import { COLORS } from "../../theme";
import type { AccentName, PackFacts } from "../../types";
import { SlideFrame } from "../components/SlideFrame";
import { STAGGER_FRAMES, useEnter } from "../motion";

function WatchRow({ item, index }: { item: PackFacts["watchlist"][number]; index: number }) {
  const enter = useEnter(10 + index * STAGGER_FRAMES * 5);
  const change = item.ratingChange === null ? "No 7-day comparison" : `${item.ratingChange >= 0 ? "+" : ""}${item.ratingChange.toFixed(2)} in 7d`;
  const facts = item.fundamentals;
  const growth = facts?.revenueGrowthTtmPct === null || facts?.revenueGrowthTtmPct === undefined ? "Revenue growth unavailable" : `Revenue growth ${facts.revenueGrowthTtmPct >= 0 ? "+" : ""}${facts.revenueGrowthTtmPct.toFixed(1)}%`;
  const revisions = facts?.revenueRevisionPct === null || facts?.revenueRevisionPct === undefined ? "Revision data unavailable" : `Revenue revisions ${facts.revenueRevisionPct >= 0 ? "+" : ""}${facts.revenueRevisionPct.toFixed(1)}%`;
  return <div style={{ opacity: enter.opacity, transform: enter.transform, borderTop: `1px solid ${COLORS.border}`, borderBottom: `1px solid ${COLORS.border}`, padding: "54px 0" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 36, alignItems: "start" }}><div><div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 52, fontWeight: 700, color: COLORS.text }}>{item.ticker}</div><div style={{ fontFamily: "Outfit", fontSize: 30, color: COLORS.text, marginTop: 8 }}>{item.name ?? "Company name unavailable"}</div><div style={{ fontFamily: "Outfit", fontSize: 20, color: COLORS.textDim, marginTop: 8 }}>{item.sector ?? "Sector unavailable"}</div></div><div style={{ textAlign: "right" }}><div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 42, color: COLORS.mint }}>{item.quantRating.toFixed(2)} / 5</div><div style={{ fontFamily: "Outfit", fontSize: 18, color: COLORS.textDim, marginTop: 8 }}>{change}</div></div></div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 44 }}><div style={{ background: COLORS.bgSecondary, padding: 22, fontFamily: "Outfit", fontSize: 22, color: COLORS.text }}>{growth}</div><div style={{ background: COLORS.bgSecondary, padding: 22, fontFamily: "Outfit", fontSize: 22, color: COLORS.text }}>{revisions}</div></div><div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 17, color: COLORS.textDim, marginTop: 24 }}>Grades: {Object.entries(item.grades).map(([factor, grade]) => `${factor} ${grade}`).join(" · ")}</div></div>;
}

export function WatchlistSlide({ chapter, accent, heading, ticker, caption, facts }: { chapter: string; accent: AccentName; heading: string; ticker?: string; caption?: string; facts: PackFacts }) {
  const headingEnter = useEnter(0);
  const items = ticker ? facts.watchlist.filter((item) => item.ticker === ticker) : facts.watchlist;
  return <SlideFrame chapter={chapter} accent={accent}><div style={{ opacity: headingEnter.opacity, transform: headingEnter.transform }}><h2 style={{ fontFamily: "Outfit", fontSize: 44, fontWeight: 700, color: COLORS.text, margin: 0 }}>{heading}</h2><p style={{ fontFamily: "Outfit", fontSize: 18, color: COLORS.textMuted, margin: "10px 0 0" }}>{caption ?? "Screener deep dive. Continue monitoring, not a recommendation."}</p></div><div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", marginTop: 30 }}>{items.map((item, index) => <WatchRow key={item.ticker} item={item} index={index} />)}</div>{facts.watchlistAsOf && <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 15, color: COLORS.textDim }}>Ratings as of {facts.watchlistAsOf}. A rating does not mean a buy.</div>}</SlideFrame>;
}
