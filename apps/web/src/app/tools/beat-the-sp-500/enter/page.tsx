import type { Metadata } from "next";
import { ChallengeBuilder } from "@/components/challenge/builder";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { CHALLENGE_PATH, ENTER_PATH, HOLD_YEARS, MAX_PICKS, MIN_PICKS } from "@/lib/challenge/rules";

export const metadata: Metadata = {
  title: "Build your Beat the S&P 500 portfolio",
  description: `Pick ${MIN_PICKS} to ${MAX_PICKS} stocks and lock them in against the S&P 500 for ${HOLD_YEARS} years.`,
  // The hub is the page to rank; this one is a form.
  robots: { index: false, follow: true },
  alternates: { canonical: ENTER_PATH },
};

export default function ChallengeEnterPage() {
  return (
    <>
      <section className="border-b border-border">
        <div className="container-op pt-8 pb-10">
          <Breadcrumbs
            items={[
              { label: "Tools", href: "/tools" },
              { label: "Beat the S&P 500", href: CHALLENGE_PATH },
              { label: "Build", href: ENTER_PATH },
            ]}
            className="mb-8"
          />
          <h1 className="font-sans text-[32px] sm:text-[40px] font-extrabold leading-[1.1] tracking-tight">
            Build your portfolio
          </h1>
          <p className="mt-3 max-w-[620px] font-sans text-[16px] leading-relaxed text-text-muted">
            {MIN_PICKS} to {MAX_PICKS} stocks, equal weight, held for {HOLD_YEARS} years
            from the next market close. Think about which ones you would still be
            happy to own in {new Date().getFullYear() + HOLD_YEARS}.
          </p>
        </div>
      </section>
      <section>
        <div className="container-op py-10">
          <ChallengeBuilder />
        </div>
      </section>
    </>
  );
}
