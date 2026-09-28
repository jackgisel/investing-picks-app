import {
  renderToolShareImage,
  shareImageContentType,
  shareImageSize,
} from "@/lib/tools/share-image";

export const runtime = "nodejs";
export const alt = "Free investing worksheets and calculators";
export const size = shareImageSize;
export const contentType = shareImageContentType;

export default function ToolsIndexOpenGraphImage() {
  return renderToolShareImage("Free investing tools");
}
