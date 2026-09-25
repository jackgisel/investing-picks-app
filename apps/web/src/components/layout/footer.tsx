import Link from "next/link";
import { OutpickWordmark } from "@/components/ui/outpick-logo";
import { SOCIAL_LINKS } from "@/lib/constants";

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

export function Footer() {
  return (
    <footer className="border-t border-border bg-bg">
      <div className="container-op py-14">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-10">
          <div>
            <OutpickWordmark />
            <p className="mt-4 font-sans text-[13px] text-text-muted max-w-xs leading-relaxed">
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
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-text-muted hover:text-text hover:border-border-strong transition-colors"
                  >
                    <Icon />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:gap-16">
            <div>
              <p className="font-sans text-[11px] font-bold tracking-[0.16em] uppercase mb-4 flex items-center gap-2.5">
                <span
                  aria-hidden
                  className="h-1 w-5 rounded-full bg-border-strong shrink-0"
                />
                Links
              </p>
              <ul className="space-y-2.5">
                <li>
                  <Link
                    href="/strategy"
                    className="font-sans text-[13px] font-semibold tracking-[0.08em] uppercase text-text-muted hover:text-text transition-colors"
                  >
                    How we invest
                  </Link>
                </li>
                <li>
                  <Link
                    href="/blog"
                    className="font-sans text-[13px] font-semibold tracking-[0.08em] uppercase text-text-muted hover:text-text transition-colors"
                  >
                    Blog
                  </Link>
                </li>
                <li>
                  <Link
                    href="/market-note"
                    className="font-sans text-[13px] font-semibold tracking-[0.08em] uppercase text-text-muted hover:text-text transition-colors"
                  >
                    Market Note
                  </Link>
                </li>
                <li>
                  <Link
                    href="/pricing"
                    className="font-sans text-[13px] font-semibold tracking-[0.08em] uppercase text-text-muted hover:text-text transition-colors"
                  >
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link
                    href="/track-record"
                    className="font-sans text-[13px] font-semibold tracking-[0.08em] uppercase text-text-muted hover:text-text transition-colors"
                  >
                    Track record
                  </Link>
                </li>
                <li>
                  <Link
                    href="/faq"
                    className="font-sans text-[13px] font-semibold tracking-[0.08em] uppercase text-text-muted hover:text-text transition-colors"
                  >
                    FAQ
                  </Link>
                </li>
                <li>
                  <Link
                    href="/what-we-are-not"
                    className="font-sans text-[13px] font-semibold tracking-[0.08em] uppercase text-text-muted hover:text-text transition-colors"
                  >
                    What we are not
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="font-sans text-[11px] font-bold tracking-[0.16em] uppercase mb-4 flex items-center gap-2.5">
                <span
                  aria-hidden
                  className="h-1 w-5 rounded-full bg-border-strong shrink-0"
                />
                Legal
              </p>
              <ul className="space-y-2.5">
                <li>
                  <Link
                    href="/terms"
                    className="font-sans text-[13px] font-semibold tracking-[0.08em] uppercase text-text-muted hover:text-text transition-colors"
                  >
                    Terms
                  </Link>
                </li>
                <li>
                  <Link
                    href="/privacy"
                    className="font-sans text-[13px] font-semibold tracking-[0.08em] uppercase text-text-muted hover:text-text transition-colors"
                  >
                    Privacy
                  </Link>
                </li>
                <li>
                  <a
                    href="mailto:hello@outpick.xyz"
                    className="font-sans text-[13px] font-semibold tracking-[0.08em] uppercase text-text-muted hover:text-text transition-colors"
                  >
                    Contact
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="font-sans text-[12px] text-text-dim">
            © {new Date().getFullYear()} Outpick
          </span>
          <span className="font-sans text-[11px] font-bold tracking-[0.2em] uppercase text-text-dim">
            Research. Pick. Track.
          </span>
        </div>
      </div>
    </footer>
  );
}
