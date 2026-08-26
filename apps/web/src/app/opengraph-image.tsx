import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import {
  SITE_NAME,
  SITE_SUBHEADLINE,
  SITE_TAGLINE,
  WINNERS_CIRCLE,
} from "@/lib/constants";

export const runtime = "nodejs";
export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#0A0A0A";
const MUTED = "#525252";
const DIM = "#737373";
const MINT = "#A8D9A0";
const GREEN = "#16A34A";

/** Phrase the hero underlines in mint — keep in lockstep with `hero.tsx`. */
const HIGHLIGHT = "beyond the index";

/**
 * Link-preview card for iMessage, X, Instagram, Slack, etc.
 *
 * This is the landing hero, flattened to 1200×630: lunar plate, light-mode
 * reading scrim, Outfit wordmark, mint underline on the tagline, and the
 * closed-winner chips that orbit the astronaut. Brand ground is light
 * (`:root` in globals.css) — dark is the opt-in, not the share default.
 *
 * `public/og-hero.jpg` is a 1200×630 cover-crop of `hero-moon.png` at the
 * desktop object-position (78% 32%). Regenerate it if the plate changes.
 */
export default async function OpenGraphImage() {
  const [medium, bold, moon] = await Promise.all([
    loadPublic("fonts/outfit-500.ttf"),
    loadPublic("fonts/outfit-800.ttf"),
    loadPublic("og-hero.jpg"),
  ]);

  const tagline = SITE_TAGLINE.replace(/\.$/, "");
  const highlightAt = tagline.indexOf(HIGHLIGHT);
  const before =
    highlightAt >= 0 ? tagline.slice(0, highlightAt).trimEnd() : tagline;
  const highlight = highlightAt >= 0 ? HIGHLIGHT : tagline;

  const bubbles = [
    { ...WINNERS_CIRCLE[0], top: 76, right: 72 },
    { ...WINNERS_CIRCLE[4], top: 198, right: 28 },
    { ...WINNERS_CIRCLE[1], top: 334, right: 88 },
  ] as const;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "#FFFFFF",
          fontFamily: "Outfit",
        }}
      >
        <img
          src={`data:image/jpeg;base64,${moon.toString("base64")}`}
          alt=""
          width={1200}
          height={630}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 1200,
            height: 630,
            objectFit: "cover",
          }}
        />

        {/* Left reading column + bottom fade — same job as the hero scrims. */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            background:
              "linear-gradient(to right, #FFFFFF 0%, #FFFFFF 15%, rgba(255,255,255,0.9) 32%, rgba(255,255,255,0.35) 50%, transparent 64%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            background:
              "linear-gradient(to top, #FFFFFF 0%, rgba(255,255,255,0.5) 16%, transparent 40%)",
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: 640,
            height: "100%",
            padding: "52px 56px 44px 64px",
            position: "relative",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
              <path
                d="M21.2 5.4A11 11 0 1 0 26.6 11.2"
                stroke={INK}
                strokeWidth="2.6"
                strokeLinecap="round"
              />
              <circle cx="25.8" cy="6.2" r="2.35" fill={MINT} />
            </svg>
            <div
              style={{
                fontSize: 26,
                fontWeight: 800,
                letterSpacing: "0.1em",
                color: INK,
                textTransform: "uppercase",
                lineHeight: 1,
              }}
            >
              Outpick
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                fontSize: 46,
                fontWeight: 800,
                color: INK,
                lineHeight: 1.14,
                letterSpacing: "-0.025em",
              }}
            >
              <div style={{ display: "flex" }}>{before}</div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignSelf: "flex-start",
                }}
              >
                <div style={{ display: "flex" }}>
                  {highlight}
                  <span>.</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    height: 4,
                    width: "92%",
                    background: MINT,
                    borderRadius: 2,
                    marginTop: 8,
                  }}
                />
              </div>
            </div>

            <div
              style={{
                display: "flex",
                fontSize: 22,
                fontWeight: 500,
                color: MUTED,
                lineHeight: 1.4,
                maxWidth: 500,
              }}
            >
              {SITE_SUBHEADLINE}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 15,
              fontWeight: 500,
              letterSpacing: "0.16em",
              color: DIM,
              textTransform: "uppercase",
            }}
          >
            outpick.xyz
          </div>
        </div>

        {bubbles.map((b) => (
          <div
            key={b.ticker}
            style={{
              position: "absolute",
              top: b.top,
              right: b.right,
              display: "flex",
              flexDirection: "column",
              background: "rgba(255,255,255,0.92)",
              border: "1px solid rgba(229,229,229,0.95)",
              borderRadius: 999,
              padding: "12px 20px 12px 18px",
              boxShadow: "0 10px 28px rgba(10,10,10,0.14)",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.1em",
                color: INK,
              }}
            >
              {b.ticker}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 18,
                fontWeight: 800,
                color: GREEN,
                marginTop: 2,
                letterSpacing: "-0.02em",
              }}
            >
              {b.ret}
            </div>
          </div>
        ))}
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Outfit",
          data: medium,
          style: "normal",
          weight: 500,
        },
        {
          name: "Outfit",
          data: bold,
          style: "normal",
          weight: 800,
        },
      ],
    },
  );
}

function loadPublic(rel: string): Promise<Buffer> {
  return readFile(join(process.cwd(), "public", rel));
}
