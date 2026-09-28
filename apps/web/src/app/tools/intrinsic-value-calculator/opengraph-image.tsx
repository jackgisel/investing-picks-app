import {
  renderToolShareImage,
  shareImageContentType,
  shareImageSize,
} from "@/lib/tools/share-image";

export const runtime = "nodejs";
export const alt = "Intrinsic value calculator";
export const size = shareImageSize;
export const contentType = shareImageContentType;

export default function Image() {
  return renderToolShareImage("Intrinsic value calculator");
}
