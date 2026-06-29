const personas = [
  {
    icon: "↗",
    title: "Ready for better returns",
    description:
      "You've done well in index funds, but you know there's upside in owning great businesses directly — if someone else does the research.",
  },
  {
    icon: "◎",
    title: "Investing with intention",
    description:
      "You want every position to have a thesis, not just a ticker weight in VOO. You care about why you own what you own.",
  },
  {
    icon: "◈",
    title: "Building real confidence",
    description:
      "Individual stock picking comes with tax flexibility and learning opportunities. You want a research team that shows its work — wins, losses, and reasoning included.",
  },
];

export function Audience() {
  return (
    <section className="border-b border-border">
      <div className="container-op py-20">
        <p className="section-label">WHY WE EXIST</p>
        <h2 className="section-title">We outgrew passive. You probably have too.</h2>
        <p className="section-sub">
          Index funds are a great starting point — but they cap your upside, offer
          no tax-loss harvesting, and leave you passive in your own portfolio.
          Outpick is the research team we wished we had when we made that leap.
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
