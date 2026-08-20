import { avatarToneIndex, initialsFor } from "@/lib/profile";
import { TONES, TONE_BG } from "@/lib/tones";

/**
 * A monogram, not an upload.
 *
 * Deliberate: profile pictures mean blob storage, resizing, and moderating
 * images people post as their face. Initials on a stable colour identify who
 * said what in a thread, which is the whole job here.
 */
export function Avatar({
  userId,
  displayName,
  size = "md",
}: {
  userId: string;
  displayName: string;
  size?: "sm" | "md";
}) {
  const tone = TONES[avatarToneIndex(userId, TONES.length)];
  const dims = size === "sm" ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-[12px]";
  return (
    <span
      // The name is already rendered next to this in every use, so the
      // monogram is decoration — announcing it would read the name twice.
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full font-sans font-bold tracking-wide text-on-accent ${TONE_BG[tone]} ${dims}`}
    >
      {initialsFor(displayName)}
    </span>
  );
}
