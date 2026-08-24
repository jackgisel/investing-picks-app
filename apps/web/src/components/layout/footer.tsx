import Link from "next/link";
import { OutpickWordmark } from "@/components/ui/outpick-logo";

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
