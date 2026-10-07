import { getEntry } from "@/lib/challenge/db";
import { cohortLabel, formatPts } from "@/lib/challenge/rules";
import {
  renderToolShareImage,
  shareImageContentType,
  shareImageSize,
} from "@/lib/tools/share-image";

export const runtime = "nodejs";
export const alt = "A Beat the S&P 500 entry";
export const size = shareImageSize;
export const contentType = shareImageContentType;
export const revalidate = 3600;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = await getEntry(id).catch(() => null);
  if (!entry || entry.hidden) {
    return renderToolShareImage("Can your picks beat the S&P 500?", "A free ten year stock picking game.", "outpick.xyz/tools/beat-the-sp-500");
  }
  const started = entry.start_date && entry.spy_start && entry.spy_last;
  const ret = entry.picks.reduce((s, p) => s + p.growth, 0) / entry.picks.length - 1;
  const excess = started ? ret - (entry.spy_last! / entry.spy_start! - 1) : null;
  const title =
    excess !== null
      ? `${entry.display_name} is ${formatPts(excess)} against the S&P 500`
      : `${entry.display_name} locked in ${entry.picks.length} stocks against the S&P 500`;
  return renderToolShareImage(
    title,
    `${cohortLabel(entry.cohort)} class. Ten years, no edits. Think you can beat it?`,
    "outpick.xyz/tools/beat-the-sp-500",
  );
}
