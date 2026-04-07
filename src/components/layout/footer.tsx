import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="container-op py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="font-mono text-[11px] text-text-dim">
          &copy; {new Date().getFullYear()} OUTPICK LLC
        </span>
        <div className="flex gap-6">
          <Link
            href="/terms"
            className="font-sans text-[12px] text-text-dim hover:text-text-muted transition-colors"
          >
            Terms of Service
          </Link>
          <Link
            href="/privacy"
            className="font-sans text-[12px] text-text-dim hover:text-text-muted transition-colors"
          >
            Privacy Policy
          </Link>
          <a
            href="mailto:hello@outpick.com"
            className="font-sans text-[12px] text-text-dim hover:text-text-muted transition-colors"
          >
            Contact
          </a>
        </div>
      </div>
    </footer>
  );
}
