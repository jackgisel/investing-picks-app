const steps = [
  {
    num: "01",
    title: "We research every pick",
    description:
      "Our team evaluates business fundamentals, financial quality, and where we are in the market cycle before anything gets published. No hype, no momentum chasing for its own sake.",
  },
  {
    num: "02",
    title: "New research every 2 weeks",
    description:
      "A high-conviction stock pick with full notes — thesis, financials, cycle context, and why we believe it belongs in a long-term portfolio.",
  },
  {
    num: "03",
    title: "Live portfolio tracking",
    description:
      "See every position with real-time status. Full transparency on entries, exits, and conviction levels. No cherry-picked highlights.",
  },
  {
    num: "04",
    title: "Performance vs. the S&P",
    description:
      "Track the full portfolio against the S&P 500 benchmark. Every gain and every loss, measured honestly.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-b border-border">
      <div className="container-op py-20">
        <p className="section-label">HOW IT WORKS</p>
        <h2 className="section-title">Research you can trust. Results you can verify.</h2>
        <p className="section-sub">
          We publish what we buy, explain why we bought it, and track it in the
          open — so you can invest with confidence, not guesswork.
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
