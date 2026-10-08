import {
  renderToolShareImage,
  shareImageContentType,
  shareImageSize,
} from "@/lib/tools/share-image";

export const runtime = "nodejs";
export const alt = "Average Down Calculator";
export const size = shareImageSize;
export const contentType = shareImageContentType;

export default function Image() {
  return renderToolShareImage("Average Down Calculator");
}
