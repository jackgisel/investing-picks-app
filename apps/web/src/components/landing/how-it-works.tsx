import Image from "next/image";
import { CategoryTag } from "@/components/ui/category-tag";
import { TONE_BORDER, type PastelTone } from "@/lib/tones";
import { PillButton } from "@/components/ui/pill-button";

const steps: {
  title: string;
  tag: string;
  description: string;
  tone: PastelTone;
  image: string;
}[] = [
  {
    title: "We research every pick",
    tag: "Research",
    description:
      "Fundamentals, financial quality, and cycle context — before anything is published. No hype, no momentum for its own sake.",
    tone: "yellow",
    image: "/illustrations/research.png",
  },
  {
    title: "New research every 2 weeks",
    tag: "Publish",
    description:
      "One high-conviction name with full notes: thesis, financials, cycle context, and why it belongs in a long-term book.",
    tone: "peach",
    image: "/illustrations/publish.png",
  },
  {
    title: "Live portfolio tracking",
    tag: "Track",
    description:
      "Every position with real-time status. Entries, exits, and conviction — no cherry-picked highlights.",
    tone: "lilac",
    image: "/illustrations/pick.png",
  },
  {
    title: "Performance vs. the S&P",
    tag: "Measure",
    description:
      "The full portfolio against the S&P 500. Every gain and every loss, measured honestly.",
    tone: "mint",
    image: "/illustrations/track.png",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="relative border-b border-border overflow-hidden"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(var(--color-bg-secondary)/0.45)_0%,transparent_42%)]"
      />

      <div className="container-op relative py-20 sm:py-24">
        <div className="max-w-[560px] mb-14 sm:mb-16">
          <p className="section-label section-label-lilac">How it works</p>
          <h2 className="section-title">
            Research you can trust. Results you can verify.
          </h2>
          <p className="section-sub mb-0">
            We publish what we buy, explain why, and track it in the open — so
            you invest with evidence, not guesswork.
          </p>
        </div>

        <div className="relative">
          <div
            aria-hidden
            className="hidden lg:block absolute left-[43px] top-6 bottom-6 w-px bg-border"
          />
          <div
            aria-hidden
            className="hidden lg:block absolute left-[42px] top-6 bottom-6 w-0.5 origin-top bg-accent-green/30 op-timeline-draw"
          />

          <ol className="space-y-0">
            {steps.map((step, i) => (
              <li
                key={step.title}
                className={`op-animate-rise relative grid grid-cols-1 md:grid-cols-[88px_1fr_minmax(0,280px)] gap-6 md:gap-10 items-center border-t border-border py-10 first:border-t-0 first:pt-0 ${
                  i === 1 ? "op-animate-rise-delay-1" : ""
                }`}
              >
                <span
                  className={`relative z-10 font-mono text-[13px] font-bold tracking-[0.14em] text-text-dim lg:flex lg:items-center lg:justify-center lg:h-12 lg:w-12 lg:rounded-full lg:border-2 lg:bg-bg ${
                    TONE_BORDER[step.tone]
                  }`}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <div className="mb-3">
                    <CategoryTag tone={step.tone}>{step.tag}</CategoryTag>
                  </div>
                  <h3 className="font-sans text-[20px] sm:text-[22px] font-bold mb-2 tracking-tight">
                    {step.title}
                  </h3>
                  <p className="font-sans text-[15px] text-text-muted leading-relaxed max-w-[440px]">
                    {step.description}
                  </p>
                </div>
                <div className="illustration-plate relative aspect-[4/3]">
                  <Image
                    src={step.image}
                    alt=""
                    fill
                    className="illustration-art object-contain p-4 sm:p-5"
                    sizes="280px"
                  />
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-12 pt-2">
          <PillButton href="/#pricing" arrow>
            See membership
          </PillButton>
        </div>
      </div>
    </section>
  );
}
