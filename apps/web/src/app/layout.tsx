import type { Metadata } from "next";
import "@/styles/globals.css";
import "@/styles/brand-heritage.css";
import { SITE_NAME, SITE_DESCRIPTION, SITE_URL, SITE_TAGLINE } from "@/lib/constants";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { MarketingOnly } from "@/components/layout/app-chrome";
import { CookieBanner } from "@/components/layout/cookie-banner";
import { FoundersBanner } from "@/components/landing/founders-banner";
import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { SITE_BRAND } from "@/lib/brand";

// Stamps the resolved theme class onto <html> before first paint so there is
// no light->dark flash. Reads the persisted choice (or falls back to the OS
// preference) using the same "outpick-theme" key and resolution rules as
// ThemeProvider.
const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem("outpick-theme");var t=s==="light"||s==="dark"||s==="system"?s:"system";var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;if(d){r.classList.add("dark")}r.style.colorScheme=d?"dark":"light"}catch(e){}})();`;

const TITLE = `${SITE_NAME} — ${SITE_TAGLINE}`;

export const metadata: Metadata = {
  title: {
    default: TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  metadataBase: new URL(SITE_URL),
  keywords: [
    "stock picks",
    "stock research",
    "value investing",
    "equity research",
    "beat the S&P 500",
    "investment newsletter",
    "Outpick",
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: TITLE,
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/twitter-image",
        width: 1200,
        height: 630,
        alt: TITLE,
      },
    ],
  },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon", type: "image/png", sizes: "180x180" }],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className="bg-bg"
      data-brand={SITE_BRAND}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="font-sans antialiased text-text bg-bg min-h-screen selection:bg-accent-yellow/50">
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <ThemeProvider>
          <QueryProvider>
            <FoundersBanner />
            <Navbar />
            <main id="main-content">{children}</main>
            <MarketingOnly>
              <Footer />
            </MarketingOnly>
            <CookieBanner />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
