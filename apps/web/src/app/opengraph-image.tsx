import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/constants";

export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function loadOutfit(weight: number) {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=Outfit:wght@${weight}&display=swap`,
    { headers: { "User-Agent": "Mozilla/5.0" } },
  ).then((res) => res.text());
  const fontUrl = css.match(/src: url\(([^)]+)\)/)?.[1];
  if (!fontUrl) return undefined;
  return fetch(fontUrl).then((res) => res.arrayBuffer());
}

/** Editorial social card — ink wordmark, one mint accent, no candy tags. */
export default async function OpenGraphImage() {
  const [medium, bold] = await Promise.all([loadOutfit(500), loadOutfit(800)]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#FFFFFF",
          padding: "72px 80px",
          fontFamily: "Outfit",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background:
              "radial-gradient(ellipse 70% 55% at 100% 0%, #A8D9A018 0%, transparent 50%)",
          }}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 28, position: "relative" }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 500,
              letterSpacing: "0.22em",
              color: "#737373",
              textTransform: "uppercase",
            }}
          >
            A stock research team
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <svg width="56" height="56" viewBox="0 0 32 32" fill="none">
              <path
                d="M21.2 5.4A11 11 0 1 0 26.6 11.2"
                stroke="#0A0A0A"
                strokeWidth="2.6"
                strokeLinecap="round"
              />
              <circle cx="25.8" cy="6.2" r="2.35" fill="#A8D9A0" />
            </svg>
            <div
              style={{
                fontSize: 56,
                fontWeight: 800,
                letterSpacing: "0.1em",
                color: "#0A0A0A",
                textTransform: "uppercase",
                lineHeight: 1,
              }}
            >
              Outpick
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 22,
            maxWidth: 900,
            position: "relative",
          }}
        >
          <div
            style={{
              width: 48,
              height: 3,
              background: "#A8D9A0",
              borderRadius: 2,
            }}
          />
          <div
            style={{
              fontSize: 44,
              fontWeight: 800,
              color: "#0A0A0A",
              lineHeight: 1.2,
              letterSpacing: "-0.02em",
            }}
          >
            {SITE_TAGLINE}
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 500,
              color: "#525252",
              lineHeight: 1.45,
              maxWidth: 720,
            }}
          >
            Value-based stock research for investors who outgrew index funds.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "relative",
            borderTop: "1px solid #E5E5E5",
            paddingTop: 28,
          }}
        >
          <div
            style={{
              fontSize: 16,
              fontWeight: 500,
              letterSpacing: "0.14em",
              color: "#737373",
              textTransform: "uppercase",
            }}
          >
            outpick.xyz
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 500,
              color: "#737373",
            }}
          >
            Researched. Tracked. Published.
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        ...(medium
          ? [{ name: "Outfit", data: medium, style: "normal" as const, weight: 500 as const }]
          : []),
        ...(bold
          ? [{ name: "Outfit", data: bold, style: "normal" as const, weight: 800 as const }]
          : []),
      ],
    },
  );
}
