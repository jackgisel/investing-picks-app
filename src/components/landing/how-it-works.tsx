const steps = [
  {
    num: "01",
    title: "New pick every 2 weeks",
    description:
      "A high-conviction stock pick with full research notes, thesis, and entry reasoning. Small caps, high growth, opportunities the index won't surface.",
  },
  {
    num: "02",
    title: "Live portfolio tracking",
    description:
      "See every position with real-time status. Full transparency on entries, exits, and conviction levels. No cherry-picked highlights.",
  },
  {
    num: "03",
    title: "Performance vs. the S&P",
    description:
      "Track the full portfolio against the S&P 500 benchmark. Every gain and every loss, measured honestly.",
  },
  {
    num: "04",
    title: "Alerts when it matters",
    description:
      "Get notified on new picks and status changes. No daily market noise, no spam — just the updates that actually matter.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-b border-border">
      <div className="container-op py-20">
        <p className="section-label">HOW IT WORKS</p>
        <h2 className="section-title">Simple. Transparent. No noise.</h2>
        <p className="section-sub">
          Everything you need to make informed decisions, nothing you don&apos;t.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-0.5 bg-border">
          {steps.map((step) => (
            <div key={step.num} className="bg-bg-secondary p-9">
              <span className="font-mono text-[32px] font-bold text-border-light block mb-4">
                {step.num}
              </span>
              <h3 className="font-sans text-base font-semibold mb-2.5">
                {step.title}
              </h3>
              <p className="font-sans text-[13px] text-text-muted leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
