import {
  renderToolShareImage,
  shareImageContentType,
  shareImageSize,
} from "@/lib/tools/share-image";

export const runtime = "nodejs";
export const alt = "Free cash flow worksheet";
export const size = shareImageSize;
export const contentType = shareImageContentType;

export default function Image() {
  return renderToolShareImage("Free cash flow worksheet");
}
