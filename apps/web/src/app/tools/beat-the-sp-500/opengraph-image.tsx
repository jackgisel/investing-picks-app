import {
  renderToolShareImage,
  shareImageContentType,
  shareImageSize,
} from "@/lib/tools/share-image";

export const runtime = "nodejs";
export const alt = "Beat the S&P 500, a free stock picking game";
export const size = shareImageSize;
export const contentType = shareImageContentType;

export default function Image() {
  return renderToolShareImage(
    "Can your picks beat the S&P 500?",
    "Pick 15 stocks. Locked in for ten years. Public leaderboard. Free.",
    "outpick.xyz/tools/beat-the-sp-500",
  );
}
