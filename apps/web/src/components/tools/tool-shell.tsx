import Link from "next/link";
import { MarketNoteSignup } from "@/components/marketing/market-note-signup";
import { Disclaimer } from "@/components/landing/disclaimer";
import { Breadcrumbs, type Crumb } from "@/components/ui/breadcrumbs";
import { getArticleBySlug } from "@/lib/blog";
import type { ToolDefinition } from "@/lib/tools/registry";
import { TOOL_BY_ID } from "@/lib/tools/registry";

function BlogLink({
  slug,
  label,
  className,
}: {
  slug: string;
  label: string;
  className?: string;
}) {
  if (!getArticleBySlug(slug)) return null;
  return (
    <p className={className}>
      <Link
        href={`/blog/${slug}`}
        className="font-sans text-[14px] font-semibold text-text underline underline-offset-2 hover:opacity-80"
      >
        {label}
      </Link>
    </p>
  );
}

export function ToolShell({
  tool,
  children,
  blogLinkPlacement = "howToRead",
  breadcrumbs,
  article,
}: {
  tool: ToolDefinition;
  children: React.ReactNode;
  blogLinkPlacement?: "howToRead" | "result";
  breadcrumbs?: Crumb[];
  article?: React.ReactNode;
}) {
  const related = tool.relatedToolIds
    .map((id) => TOOL_BY_ID[id])
    .filter(Boolean)
    .slice(0, 3);

  return (
    <>
      <div className="container-op border-b border-border py-14 sm:py-16">
        <div className="max-w-[720px]">
          {breadcrumbs ? (
            <Breadcrumbs
              items={breadcrumbs}
              className="mb-8"
              includeJsonLd={false}
            />
          ) : null}
          <p className="section-label">{tool.eyebrow}</p>
          <h1 className="section-title">{tool.h1}</h1>
          <p className="section-sub mb-0">{tool.subtitle}</p>
        </div>
      </div>

      <section className="border-b border-border">
        <div className="container-op py-12 sm:py-16">{children}</div>
      </section>

      <section className="border-b border-border bg-bg-secondary/20">
        <div className="container-op py-12 sm:py-14 max-w-[720px]">
          <h2 className="font-sans text-[13px] font-bold uppercase tracking-[0.14em] text-text-dim mb-4">
            How to read this
          </h2>
          <div className="space-y-3 font-sans text-[15px] leading-relaxed text-text-muted">
            {tool.howToRead.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
          {tool.blogSlug && blogLinkPlacement === "howToRead" ? (
            <BlogLink
              slug={tool.blogSlug}
              label={tool.blogLinkLabel ?? tool.blogSlug}
              className="mt-5"
            />
          ) : null}
        </div>
      </section>

      {article ? (
        <section className="border-b border-border">
          <div className="container-op py-12 sm:py-16">{article}</div>
        </section>
      ) : null}

      <section className="border-b border-border">
        <div className="container-op py-12 sm:py-14 max-w-[720px]">
          <h2 className="font-sans text-[13px] font-bold uppercase tracking-[0.14em] text-text-dim mb-6">
            Questions
          </h2>
          <dl className="space-y-6">
            {tool.faq.map((item) => (
              <div key={item.q}>
                <dt className="font-sans text-[16px] font-bold text-text mb-2">
                  {item.q}
                </dt>
                <dd className="font-sans text-[15px] leading-relaxed text-text-muted">
                  {item.a}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {related.length > 0 ? (
        <section className="border-b border-border">
          <div className="container-op py-10 sm:py-12 max-w-[720px]">
            <h2 className="font-sans text-[13px] font-bold uppercase tracking-[0.14em] text-text-dim mb-4">
              Related tools
            </h2>
            <ul className="space-y-2">
              {related.map((r) => (
                <li key={r.id}>
                  <Link
                    href={r.path}
                    className="font-sans text-[15px] font-semibold text-text hover:opacity-80 underline underline-offset-2"
                  >
                    {r.h1}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <section className="border-b border-border">
        <div className="container-op py-12 sm:py-14 max-w-[720px]">
          <MarketNoteSignup source={tool.marketNoteSource} variant="panel" />
        </div>
      </section>

      <Disclaimer />
      <div className="container-op py-12 sm:py-14 max-w-[720px] space-y-4 border-b border-border">
          <p className="font-sans text-[13px] text-text-dim leading-relaxed">
            This page does arithmetic on the figures shown. It is not a price
            target, a forecast, or a recommendation.
          </p>
          <p className="font-sans text-[14px]">
            <Link
              href="/pricing"
              className="font-semibold text-text underline underline-offset-2 hover:opacity-80"
            >
              The written research is the membership.
            </Link>
          </p>
          <nav
            aria-label="Tool footer"
            className="flex flex-wrap gap-x-4 gap-y-2 pt-2 font-sans text-[13px] font-semibold uppercase tracking-[0.08em] text-text-muted"
          >
            <Link href="/tools" className="hover:text-text">
              All tools
            </Link>
            <Link href="/strategy" className="hover:text-text">
              How we invest
            </Link>
            <Link href="/what-we-are-not" className="hover:text-text">
              What we are not
            </Link>
            <Link href="/market-note" className="hover:text-text">
              Market Note
            </Link>
          </nav>
          {tool.extraEssaySlug ? (
            <BlogLink
              slug={tool.extraEssaySlug}
              label={tool.extraEssayLabel ?? tool.extraEssaySlug}
            />
          ) : null}
          {tool.blogSlug && blogLinkPlacement === "result" ? (
            <BlogLink
              slug={tool.blogSlug}
              label={tool.blogLinkLabel ?? tool.blogSlug}
            />
          ) : null}
      </div>
    </>
  );
}

export function ToolGrid({
  inputs,
  result,
}: {
  inputs: React.ReactNode;
  result: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-14 lg:items-start">
      <div className="soft-card p-6 sm:p-8">{inputs}</div>
      <div className="soft-card p-6 sm:p-8">{result}</div>
    </div>
  );
}

export function ToolFieldLabel({
  htmlFor,
  children,
  hint,
}: {
  htmlFor: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="mb-4">
      <label
        htmlFor={htmlFor}
        className="block font-sans text-[13px] font-bold uppercase tracking-[0.1em] text-text-dim mb-2"
      >
        {children}
      </label>
      {hint ? (
        <p className="font-sans text-[12px] text-text-dim mb-2 leading-relaxed">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const toolInputClass =
  "w-full rounded-soft border border-border-strong bg-bg px-4 py-2.5 font-mono text-[15px] tabular-nums text-text placeholder:text-text-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

export function SnapshotNotice({ message }: { message: string }) {
  return (
    <p className="font-sans text-[13px] text-text-muted leading-relaxed mb-4">
      {message}
    </p>
  );
}

export function ResultLine({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 py-2 border-b border-border last:border-0">
      <span className="font-sans text-[14px] text-text-muted">{label}</span>
      <span
        className={
          mono
            ? "font-mono text-[15px] font-semibold tabular-nums text-text"
            : "font-sans text-[15px] font-semibold text-text"
        }
      >
        {value}
      </span>
    </div>
  );
}
