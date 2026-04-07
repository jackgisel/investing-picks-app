const personas = [
  {
    icon: ">_",
    title: "The busy professional",
    description:
      "You have a career you love. You want your money working harder than an index fund, but you don't have 4 hours a night for research.",
  },
  {
    icon: "%",
    title: "The graduated ETF investor",
    description:
      "You've maxed out your 401k, you hold VOO, and you're ready to allocate a portion to higher-growth individual picks.",
  },
  {
    icon: "&",
    title: "The curious builder",
    description:
      "You want to learn how to evaluate stocks by watching a real portfolio in action — the wins, the losses, and the reasoning behind each.",
  },
];

export function Audience() {
  return (
    <section className="border-b border-border">
      <div className="container-op py-20">
        <p className="section-label">WHO THIS IS FOR</p>
        <h2 className="section-title">Between passive and obsessed.</h2>
        <p className="section-sub">
          You know ETFs aren&apos;t your ceiling. But you don&apos;t want stock
          picking to become your full-time job. We&apos;re the research team in
          your corner.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-0.5 bg-border">
          {personas.map((p) => (
            <div
              key={p.title}
              className="bg-bg-secondary p-9 text-center"
            >
              <span className="block font-mono text-[28px] text-accent-green mb-4">
                {p.icon}
              </span>
              <h3 className="font-sans text-[15px] font-semibold mb-2">
                {p.title}
              </h3>
              <p className="font-sans text-[12px] text-text-muted leading-relaxed">
                {p.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
