import Link from "next/link";
import { OutpickWordmark } from "@/components/ui/outpick-logo";
import { MarketNoteSignup } from "@/components/marketing/market-note-signup";
import { BLOG_CATEGORIES, categoryPath } from "@/lib/blog-taxonomy";
import { sectorPath } from "@/lib/companies";
import { SOCIAL_LINKS, SUPPORT_EMAIL } from "@/lib/constants";
import { ALL_TOOL_LINKS, NAV_SECTIONS, type NavLink } from "@/lib/site-nav";

// Brand marks inline — lucide has no X logo, and its YouTube glyph is an outline.
function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-[18px] w-[18px] fill-current">
      <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 fill-current">
      <path d="M18.9 1.2h3.7l-8 9.2L24 22.8h-7.4l-5.8-7.6-6.6 7.6H.5l8.6-9.8L0 1.2h7.6l5.2 6.9 6.1-6.9Zm-1.3 19.4h2L6.5 3.3H4.3l13.3 17.3Z" />
    </svg>
  );
}

const SOCIALS = [
  { href: SOCIAL_LINKS.youtube, label: "Outpick on YouTube", Icon: YouTubeIcon },
  { href: SOCIAL_LINKS.x, label: "Outpick on X", Icon: XIcon },
];

/** FMP's sector names. Linked here so every sector page is one hop from any page. */
const FOOTER_SECTORS = ["Technology", "Healthcare", "Financial Services", "Industrials", "Consumer Cyclical"];

const outpick = NAV_SECTIONS.find((s) => s.id === "outpick")!;

const COLUMNS: { title: string; links: NavLink[] }[] = [
  {
    title: "Research",
    links: [
      ...BLOG_CATEGORIES.map((c) => ({ label: c.title, href: categoryPath(c) })),
      { label: "All articles", href: "/blog" },
    ],
  },
  {
    title: "Free tools",
    links: [...ALL_TOOL_LINKS, { label: "All tools", href: "/tools" }],
  },
  {
    title: "Data",
    links: [
      { label: "Company directory", href: "/companies" },
      { label: "Revenue per employee", href: "/workforce" },
      ...FOOTER_SECTORS.map((s) => ({ label: s, href: sectorPath(s) })),
    ],
  },
  {
    title: "Outpick",
    links: outpick.groups.flatMap((g) => g.links),
  },
];

const linkClass =
  "font-sans text-[14px] text-text-muted hover:text-text transition-colors";

function ColumnTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 flex items-center gap-2.5 font-sans text-[11px] font-bold uppercase tracking-[0.16em]">
      <span aria-hidden className="h-1 w-5 shrink-0 rounded-full bg-border-strong" />
      {children}
    </p>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border bg-bg">
      <div className="container-op py-14">
        <div className="grid grid-cols-1 gap-10 border-b border-border pb-12 lg:grid-cols-[1fr_minmax(0,560px)] lg:items-end">
          <div>
            <OutpickWordmark />
            <p className="mt-4 max-w-xs font-sans text-[14px] leading-relaxed text-text-muted">
              Intentional investing beyond the index.
            </p>
            <ul className="mt-5 flex items-center gap-2.5">
              {SOCIALS.map(({ href, label, Icon }) => (
                <li key={href}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    title={label}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-text-muted transition-colors hover:border-border-strong hover:text-text"
                  >
                    <Icon />
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <MarketNoteSignup source="footer" variant="panel" />
        </div>

        <nav
          aria-label="Footer"
          className="grid grid-cols-2 gap-x-8 gap-y-10 pt-12 sm:grid-cols-3 lg:grid-cols-5"
        >
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <ColumnTitle>{col.title}</ColumnTitle>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className={linkClass}>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div>
            <ColumnTitle>Legal</ColumnTitle>
            <ul className="space-y-2.5">
              <li>
                <Link href="/terms" className={linkClass}>Terms</Link>
              </li>
              <li>
                <Link href="/privacy" className={linkClass}>Privacy</Link>
              </li>
              <li>
                <a href={`mailto:${SUPPORT_EMAIL}`} className={linkClass}>Contact</a>
              </li>
            </ul>
          </div>
        </nav>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 sm:flex-row">
          <span className="font-sans text-[12px] text-text-dim">
            © {new Date().getFullYear()} Outpick. Research, not personal advice.
          </span>
          <span className="font-sans text-[11px] font-bold uppercase tracking-[0.2em] text-text-dim">
            Research. Pick. Track.
          </span>
        </div>
      </div>
    </footer>
  );
}
