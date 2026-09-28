import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const shareImageSize = { width: 1200, height: 630 };
export const shareImageContentType = "image/png";

const BG = "#0A0A0A";
const TEXT = "#FAFAFA";
const MUTED = "#A3A3A3";
const MINT = "#A8D9A0";
const BORDER = "#262626";

function loadPublic(rel: string): Promise<Buffer> {
  return readFile(join(process.cwd(), "public", rel));
}

/** Dark 1200×630 share card naming the tool. No tickers, targets, or returns. */
export async function renderToolShareImage(title: string) {
  const [medium, bold] = await Promise.all([
    loadPublic("fonts/outfit-500.ttf"),
    loadPublic("fonts/outfit-800.ttf"),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: BG,
          padding: "56px 64px",
          fontFamily: "Outfit",
          border: `1px solid ${BORDER}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <svg width="36" height="36" viewBox="0 0 32 32" fill="none">
            <path
              d="M21.2 5.4A11 11 0 1 0 26.6 11.2"
              stroke={TEXT}
              strokeWidth="2.6"
              strokeLinecap="round"
            />
            <circle cx="25.8" cy="6.2" r="2.35" fill={MINT} />
          </svg>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: "0.12em",
              color: TEXT,
              textTransform: "uppercase",
            }}
          >
            Outpick
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            maxWidth: 980,
          }}
        >
          <div
            style={{
              fontSize: 52,
              fontWeight: 800,
              color: TEXT,
              lineHeight: 1.12,
              letterSpacing: "-0.03em",
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 500,
              color: MUTED,
              lineHeight: 1.35,
            }}
          >
            Free public worksheet. Arithmetic only.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 15,
            fontWeight: 500,
            letterSpacing: "0.16em",
            color: MUTED,
            textTransform: "uppercase",
          }}
        >
          outpick.xyz/tools
        </div>
      </div>
    ),
    {
      ...shareImageSize,
      fonts: [
        { name: "Outfit", data: medium, style: "normal", weight: 500 },
        { name: "Outfit", data: bold, style: "normal", weight: 800 },
      ],
    },
  );
}
