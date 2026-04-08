import {
  TrendingUp,
  LineChart,
  Search,
  Gauge,
  ShieldAlert,
  Sparkles,
  Cpu,
} from "lucide-react";

const AGENTS = [
  {
    code: "APEX",
    role: "Growth Hunter",
    icon: TrendingUp,
    research:
      "Scans every US-listed stock for revenue and EPS reacceleration. Cares about second-derivative trends, not just absolute growth — the inflection point matters more than the starting line.",
    weight: "35% of the composite score",
  },
  {
    code: "REVI",
    role: "Revisions Reader",
    icon: LineChart,
    research:
      "Tracks every analyst estimate revision in real time and rates the velocity of upgrades vs downgrades. Built around the conviction that price follows revisions on 6–18 month horizons.",
    weight: "30% of the composite score",
  },
  {
    code: "AUDIT",
    role: "Quality Auditor",
    icon: Search,
    research:
      "Reads margins, ROE, free cash flow conversion, and balance sheets line by line. Skeptical by default. Refuses any name with an Altman Z-score below 1.8 — no catching falling knives.",
    weight: "15% of the composite score",
  },
  {
    code: "TAPE",
    role: "Momentum Reader",
    icon: Gauge,
    research:
      "Quant tape reader. Measures relative strength, absolute momentum, and trend regime across multiple timeframes. Vetoes any candidate with negative trailing 12-month returns.",
    weight: "15% of the composite score",
  },
  {
    code: "GUARD",
    role: "Risk Officer",
    icon: ShieldAlert,
    research:
      "Holds the keys to the portfolio's risk envelope: 30% sector concentration cap, drawdown circuit breaker at 15% from peak, and bankruptcy filters. Halts new buying when the portfolio is under stress.",
    weight: "Veto authority on every trade",
  },
  {
    code: "HELM",
    role: "Portfolio Manager",
    icon: Sparkles,
    research:
      "Synthesizes every other agent's input and makes the final allocation calls — sizing, conviction adds, and the two-tier position management. Once a position pays back its cost basis, HELM lets the rest run as house money with no cap.",
    weight: "Final say on every position",
  },
] as const;

export function Agents() {
  return (
    <section id="agents" className="border-b border-border">
      <div className="container-op py-20">
        <p className="section-label">THE SIX AGENTS</p>
        <h2 className="section-title">An AI hedge fund, in your pocket.</h2>
        <p className="section-sub">
          We&apos;re building our own AI-run hedge fund — and you get the
          picks. Six specialized agents do the research, manage the risk, and
          run the portfolio together. Every trade is the output of all six
          agreeing.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-0.5 bg-border mb-0.5">
          {AGENTS.map((agent) => {
            const Icon = agent.icon;
            return (
              <div key={agent.code} className="bg-bg-secondary p-7">
                <div className="flex items-center gap-3 mb-3">
                  <Icon size={16} className="text-accent-green" />
                  <span className="font-mono text-[11px] tracking-[2px] font-bold text-accent-green bg-accent-green-soft px-2 py-1">
                    {agent.code}
                  </span>
                  <span className="font-sans text-[14px] font-semibold">
                    {agent.role}
                  </span>
                </div>
                <p className="font-sans text-[13px] text-text-muted leading-relaxed mb-3">
                  {agent.research}
                </p>
                <p className="font-mono text-[10px] text-text-dim tracking-[1.5px] uppercase">
                  {agent.weight}
                </p>
              </div>
            );
          })}
        </div>

        <div className="bg-bg-secondary border-t border-border p-7 flex items-start gap-4">
          <Cpu size={18} className="text-accent-green shrink-0 mt-0.5" />
          <div>
            <h3 className="font-sans text-[15px] font-semibold mb-1.5">
              Why six agents instead of one model?
            </h3>
            <p className="font-sans text-[13px] text-text-muted leading-relaxed">
              A monolithic model averages its mistakes across every decision.
              Six specialized agents with veto authority disagree productively
              — growth signals can be wrong, revisions can be lagging,
              momentum can be a trap. Forcing each domain to defend itself
              separately is what keeps junk out of the portfolio. It&apos;s
              the same operating model real hedge funds use, automated and
              made transparent.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
