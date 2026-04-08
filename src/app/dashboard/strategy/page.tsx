"use client";

import { BACKTEST, WINNERS_CIRCLE } from "@/lib/constants";
import {
  TrendingUp,
  BarChart3,
  Activity,
  ArrowDown,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  Search,
  LineChart,
  ShieldAlert,
  Gauge,
  Sparkles,
} from "lucide-react";

function holdLabel(entry: string, exit: string): string {
  const start = new Date(entry).getTime();
  const end = new Date(exit).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return "—";
  const days = Math.max(0, Math.round((end - start) / (1000 * 60 * 60 * 24)));
  if (days < 60) return `${days}d`;
  const months = Math.round(days / 30.44);
  if (months < 18) return `${months}mo`;
  return `${(months / 12).toFixed(1)}y`;
}

export default function StrategyPage() {
  return (
    <div className="max-w-[900px] space-y-12">
      {/* Header */}
      <div>
        <h1 className="font-sans text-xl font-bold">The Outpick Strategy</h1>
        <p className="font-sans text-[13px] text-text-dim mt-1">
          Six AI agents · One portfolio · Built to beat the S&amp;P
        </p>
      </div>

      {/* Origin / thesis */}
      <section>
        <h2 className="font-mono text-[10px] text-accent-green tracking-[2px] mb-4">
          ORIGIN
        </h2>
        <div className="space-y-4 font-sans text-[14px] text-text-muted leading-relaxed max-w-[720px]">
          <p>
            The Outpick Strategy is an{" "}
            <strong className="text-text">AI agent-driven equity research system</strong>.
            Six specialized agents — each with its own quantitative research or
            portfolio management personality — collaborate every two weeks to
            find high-growth companies, manage risk, and let winners compound
            without capping their upside.
          </p>
          <p>
            The agents were trained on nearly four years of historical equity
            data and validated against{" "}
            <strong className="text-text">104 high-conviction picks</strong>{" "}
            from July 2022 to April 2026. The exercise gave us a structural
            understanding of how the biggest winners actually behave — and
            taught the agents what to repeat and what to avoid.
          </p>
          <p>
            The core insight: equity returns are profoundly{" "}
            <strong className="text-text">fat-tailed</strong>. In the validation
            set, the top 3 closed picks (APP +1,571%, CLS +1,167%, SMCI +969%)
            contributed 60% of all portfolio gains. Traditional position capping
            at 10% would have destroyed those multi-baggers. The Outpick agents
            are built to <em>not</em> make that mistake.
          </p>
        </div>
      </section>

      {/* The Six Agents */}
      <section>
        <h2 className="font-mono text-[10px] text-accent-green tracking-[2px] mb-4">
          THE SIX AGENTS
        </h2>
        <p className="font-sans text-[14px] text-text-muted leading-relaxed max-w-[720px] mb-6">
          Every pick — and every trim, hold, or exit — is the output of six AI
          agents working together. Five do quantitative research; one runs the
          portfolio. Each agent has a single job, a strong opinion, and the
          authority to veto a trade inside its domain.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AgentCard
            codename="APEX"
            role="Growth Hunter"
            icon={TrendingUp}
            text="Hunts revenue and EPS reacceleration. Cares about second-derivative trends, not just absolute growth. Weights the composite score 35% toward growth signals."
          />
          <AgentCard
            codename="REVI"
            role="Revisions Reader"
            icon={LineChart}
            text="Tracks every analyst estimate revision and rates the velocity of upgrades vs downgrades. Believes price follows revisions on 6–18 month horizons. Weights the composite 30% toward revision momentum."
          />
          <AgentCard
            codename="AUDIT"
            role="Quality Auditor"
            icon={Search}
            text="Reads margins, ROE, free cash flow conversion and balance sheets. Skeptical by default — won't sign off on a name that can't fund its own growth. Refuses anything below an Altman Z-score of 1.8."
          />
          <AgentCard
            codename="TAPE"
            role="Momentum Reader"
            icon={Gauge}
            text="Quant tape reader. Measures relative strength, absolute momentum, and trend regime. Vetoes any candidate with negative trailing 12-month returns. The trend is its friend."
          />
          <AgentCard
            codename="GUARD"
            role="Risk Officer"
            icon={ShieldAlert}
            text="Holds the keys to the portfolio's risk envelope: 30% sector concentration cap, drawdown circuit breaker at 15% from peak, and bankruptcy filters. Halts new buying when the portfolio is under stress."
          />
          <AgentCard
            codename="HELM"
            role="Portfolio Manager"
            icon={Sparkles}
            text="Synthesizes input from the other five agents and makes the final allocation calls — sizing, conviction adds, and the two-tier position management. Once a position pays back its cost basis, HELM lets the rest run as house money with no cap."
          />
        </div>
        <div className="bg-bg-secondary border border-border p-5 mt-4 flex items-start gap-3">
          <Cpu size={16} className="text-accent-green shrink-0 mt-0.5" />
          <p className="font-sans text-[13px] text-text-muted leading-relaxed">
            <strong className="text-text">Why six agents and not one model?</strong>{" "}
            A monolithic model averages its mistakes across every decision. Six
            specialized agents with veto authority disagree productively —
            growth signals can be wrong, revisions can be lagging, momentum can
            be a trap. Forcing each domain to defend itself separately is what
            keeps junk out of the portfolio.
          </p>
        </div>
      </section>

      {/* Stock Selection */}
      <section>
        <h2 className="font-mono text-[10px] text-accent-green tracking-[2px] mb-4">
          STOCK SELECTION
        </h2>
        <p className="font-sans text-[14px] text-text-muted leading-relaxed max-w-[720px] mb-6">
          Every two weeks, the research agents (APEX, REVI, AUDIT, TAPE) score
          approximately{" "}
          <strong className="text-text">3,600 US-listed stocks</strong> across
          five fundamental factors. Each stock is ranked within its GICS sector
          using percentile scoring — a high-growth tech name isn&apos;t
          penalized for having different margins than a utility.
        </p>

        {/* Factor weights */}
        <div className="bg-bg-secondary border border-border p-6 mb-4">
          <p className="font-mono text-[10px] text-text-dim tracking-[2px] mb-4">
            FACTOR WEIGHTS
          </p>
          <div className="space-y-3">
            <FactorBar label="GROWTH" weight={35} description="Revenue & EPS trajectory, acceleration" />
            <FactorBar label="ANALYST REVISIONS" weight={30} description="Upgrades to estimates, momentum of change" />
            <FactorBar label="PROFITABILITY" weight={15} description="Margins, ROE, cash conversion" />
            <FactorBar label="MOMENTUM" weight={15} description="Price action, relative strength" />
            <FactorBar label="VALUATION" weight={5} description="Intentionally low — we don't pay for cheap" />
          </div>
        </div>

        <p className="font-sans text-[13px] text-text-muted leading-relaxed max-w-[720px]">
          The heavy tilt toward growth and revisions reflects a core finding:
          stocks where analysts are{" "}
          <strong className="text-text">actively raising estimates</strong> while
          the company is delivering{" "}
          <strong className="text-text">accelerating</strong> revenue and
          earnings tend to outperform over 6–18 month horizons. The five factor
          percentiles combine into a composite score mapped to a quant rating
          from 1.0 to 5.0. Only stocks scoring above 4.0 — with at least a B+ in
          revisions and a B in growth — qualify as buy candidates.
        </p>
      </section>

      {/* Risk filters */}
      <section>
        <h2 className="font-mono text-[10px] text-accent-green tracking-[2px] mb-4">
          RISK FILTERS
        </h2>
        <p className="font-sans text-[14px] text-text-muted leading-relaxed max-w-[720px] mb-5">
          Before any stock enters the portfolio, GUARD runs it through three
          safety gates. A drawdown circuit breaker halts all new buying if the
          portfolio drops 15% from peak.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FilterCard
            title="Altman Z-Score Floor"
            value="≥ 1.8"
            text="Rejects bankruptcy-risk companies. No catching falling knives that won't get up."
          />
          <FilterCard
            title="Sector Concentration Cap"
            value="≤ 30%"
            text="No single sector dominates the portfolio. Forced diversification across the economy."
          />
          <FilterCard
            title="Absolute Momentum Filter"
            value="12mo > 0"
            text="Penalizes stocks with negative trailing 12-month returns. Trend is your friend."
          />
        </div>
      </section>

      {/* Position management */}
      <section>
        <h2 className="font-mono text-[10px] text-accent-green tracking-[2px] mb-4">
          POSITION MANAGEMENT — LET WINNERS RUN
        </h2>
        <p className="font-sans text-[14px] text-text-muted leading-relaxed max-w-[720px] mb-6">
          This is where the strategy diverges most from conventional quant
          approaches. HELM, the portfolio manager agent, uses a{" "}
          <strong className="text-text">two-tier position management</strong>{" "}
          approach designed around the fat-tailed nature of equity returns.
        </p>

        <div className="space-y-3">
          <TierCard
            tier="TIER 1"
            title="Normal positions"
            subtitle="Trim only above 15% of portfolio"
            text="Most positions are left alone. We don't trim winners that are still grinding higher within sensible weight bounds. Trimming a compounder to take profits is the single biggest mistake retail does."
          />
          <TierCard
            tier="TIER 2"
            title="House money positions"
            subtitle="No cap at all"
            text="Once a winning stock pays back its original cost basis through a partial sale, the remaining shares become 'house money' with no cap whatsoever. This mirrors how Alpha Picks let POWL grow from 2% to 9.3% of their portfolio."
          />
        </div>

        <div className="bg-bg-secondary border border-border p-6 mt-4">
          <h3 className="font-mono text-[10px] text-accent-green tracking-[2px] mb-2">
            CONVICTION ADDS
          </h3>
          <p className="font-sans text-[13px] text-text-muted leading-relaxed">
            When a stock already in the portfolio continues to rank among the top
            picks <em>and</em> has gained at least 30%, the system{" "}
            <strong className="text-text">buys more</strong> — adding to winners
            rather than skipping them. Alpha Picks did this with five stocks
            (POWL, STRL, CLS, MFC, EAT), each bought at progressively higher
            prices as conviction grew. We do the same.
          </p>
        </div>
      </section>

      {/* Validation / Backtest */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="font-mono text-[10px] text-accent-green tracking-[2px]">
            HISTORICAL BACKTEST
          </h2>
          <span className="font-mono text-[9px] tracking-[1.5px] font-bold bg-bg-tertiary text-text-muted px-2 py-1 inline-block border border-border">
            SIMULATED · NOT LIVE
          </span>
        </div>
        <p className="font-sans text-[14px] text-text-muted leading-relaxed max-w-[720px] mb-2">
          The strategy was validated using{" "}
          <strong className="text-text">walk-forward backtesting</strong>:
          parameters were optimized on data from{" "}
          <strong className="text-text">Jun 2022 — Jul 2024</strong>, then tested
          on an unseen validation period from{" "}
          <strong className="text-text">Jul 2024 — Apr 2026</strong>.
        </p>
        <p className="font-sans text-[13px] text-text-dim leading-relaxed max-w-[720px] mb-6">
          The combined system returned{" "}
          <strong className="text-text">{BACKTEST.totalReturn}</strong> over the
          full period vs <strong className="text-text">{BACKTEST.spyReturn}</strong>{" "}
          for the S&P 500 — generating{" "}
          <strong className="text-text">{BACKTEST.validationAlpha} alpha in the validation period alone</strong>.
        </p>

        {/* Hero metric */}
        <div className="bg-bg-secondary border border-border p-7 mb-3">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <p className="font-mono text-[10px] text-text-dim tracking-[2px]">
              BACKTEST RETURN
            </p>
            <p className="font-mono text-[10px] text-text-dim tracking-[1.5px]">
              {BACKTEST.startDate} → {BACKTEST.endDate}
            </p>
          </div>
          <p className="font-mono text-[48px] font-bold text-accent-green leading-none">
            {BACKTEST.totalReturn}
          </p>
          <p className="font-sans text-[14px] text-text-muted mt-3">
            Compounded over {BACKTEST.yearsCovered} years (simulation) — vs{" "}
            {BACKTEST.spyReturn} for the S&amp;P 500 over the same window
          </p>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <BacktestMetric
            label="CAGR"
            value={BACKTEST.cagr}
            icon={Activity}
            green
          />
          <BacktestMetric
            label="ALPHA"
            value={BACKTEST.alpha}
            icon={BarChart3}
            green
          />
          <BacktestMetric
            label="SHARPE"
            value={BACKTEST.sharpe}
            icon={TrendingUp}
            green
          />
          <BacktestMetric
            label="MAX DRAWDOWN"
            value={BACKTEST.maxDrawdown}
            icon={ArrowDown}
            red
          />
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mt-3">
          {[
            { label: "WIN RATE", value: `${BACKTEST.winRate} (${BACKTEST.wins}W/${BACKTEST.losses}L)` },
            { label: "TRADES", value: String(BACKTEST.trades) },
            { label: "S&P 500", value: BACKTEST.spyReturn },
            { label: "VALIDATION ALPHA", value: BACKTEST.validationAlpha },
            { label: "DOUBLED", value: `${BACKTEST.winnersCircle} stocks` },
            { label: "MAX DD DATE", value: BACKTEST.maxDrawdownDate },
          ].map((m) => (
            <div
              key={m.label}
              className="bg-bg-secondary border border-border p-4 text-center"
            >
              <span className="font-mono text-[9px] text-text-dim tracking-[1.5px] block mb-1">
                {m.label}
              </span>
              <span className="font-mono text-[12px] font-semibold">
                {m.value}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Winners circle */}
      <section>
        <div className="flex items-center gap-3 mb-3">
          <h2 className="font-mono text-[10px] text-accent-green tracking-[2px]">
            WINNERS CIRCLE
          </h2>
          <span className="font-mono text-[9px] tracking-[1.5px] font-bold bg-bg-tertiary text-text-muted px-2 py-1 inline-block border border-border">
            BACKTEST
          </span>
        </div>
        <p className="font-sans text-[13px] text-text-muted leading-relaxed max-w-[720px] mb-5">
          The {BACKTEST.winnersCircle} positions that doubled (≥100% gain)
          during the {BACKTEST.yearsCovered}-year backtest. Argentine financials
          (YPF, BMA, IRS, TGS) and AI infrastructure (AVGO) drove most of the
          fat-tailed upside.
        </p>

        <div className="bg-bg-secondary border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {["TICKER", "ENTRY DATE", "EXIT DATE", "HOLD", "RETURN"].map((h) => (
                    <th
                      key={h}
                      className="font-mono text-left px-5 py-3 text-[10px] text-text-dim tracking-[1.5px] font-medium border-b border-border bg-bg"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {WINNERS_CIRCLE.map((w, i) => (
                  <tr
                    key={`${w.ticker}-${w.entry}-${i}`}
                    className="border-b border-border last:border-b-0 hover:bg-bg-tertiary/50 transition-colors"
                  >
                    <td className="px-5 py-3.5 font-mono font-semibold text-[14px]">
                      {w.ticker}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[11px] text-text-dim">
                      {w.entry}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[11px] text-text-dim">
                      {w.exit}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[11px] text-text-muted">
                      {holdLabel(w.entry, w.exit)}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[13px] font-bold text-accent-green">
                      {w.ret}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Honesty section */}
      <section>
        <h2 className="font-mono text-[10px] text-accent-green tracking-[2px] mb-4">
          WHAT BACKTESTS DO &amp; DON&apos;T PROVE
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-bg-secondary border border-border p-5">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 size={14} className="text-accent-green" />
              <span className="font-mono text-[10px] text-accent-green tracking-[1.5px] font-semibold">
                WHAT IT PROVES
              </span>
            </div>
            <ul className="space-y-2 font-sans text-[13px] text-text-muted leading-relaxed list-none">
              <li>• Rules are unambiguous and reproducible</li>
              <li>• Out-of-sample period beat the index by {BACKTEST.validationAlpha}</li>
              <li>• Drawdowns are tolerable ({BACKTEST.maxDrawdown}, not 80% wipeouts)</li>
              <li>• Sharpe of {BACKTEST.sharpe} suggests a real edge, not luck</li>
            </ul>
          </div>
          <div className="bg-bg-secondary border border-border p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={14} className="text-accent-red" />
              <span className="font-mono text-[10px] text-accent-red tracking-[1.5px] font-semibold">
                WHAT IT DOESN&apos;T
              </span>
            </div>
            <ul className="space-y-2 font-sans text-[13px] text-text-muted leading-relaxed list-none">
              <li>• Predict future returns</li>
              <li>• Account for slippage perfectly</li>
              <li>• Guarantee any specific outcome</li>
              <li>• Replace real, live, audited performance</li>
            </ul>
          </div>
        </div>
        <p className="font-sans text-[12px] text-text-dim leading-relaxed mt-5 max-w-[720px]">
          That&apos;s why all live performance is tracked separately on the{" "}
          <a
            href="/dashboard/performance"
            className="text-accent-green hover:underline"
          >
            Performance
          </a>{" "}
          page. Real money, real trades, no cherry-picking.
        </p>
      </section>
    </div>
  );
}

function FactorBar({
  label,
  weight,
  description,
}: {
  label: string;
  weight: number;
  description: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-[11px] text-text tracking-[1px] font-semibold">
            {label}
          </span>
          <span className="font-sans text-[11px] text-text-dim">
            {description}
          </span>
        </div>
        <span className="font-mono text-[12px] font-bold text-accent-green">
          {weight}%
        </span>
      </div>
      <div className="h-1 bg-bg w-full overflow-hidden">
        <div
          className="h-full bg-accent-green"
          style={{ width: `${weight * 2}%` }}
        />
      </div>
    </div>
  );
}

function FilterCard({
  title,
  value,
  text,
}: {
  title: string;
  value: string;
  text: string;
}) {
  return (
    <div className="bg-bg-secondary border border-border p-5">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="font-sans text-[13px] font-semibold">{title}</h3>
        <span className="font-mono text-[12px] font-bold text-accent-green">
          {value}
        </span>
      </div>
      <p className="font-sans text-[12px] text-text-muted leading-relaxed">
        {text}
      </p>
    </div>
  );
}

function TierCard({
  tier,
  title,
  subtitle,
  text,
}: {
  tier: string;
  title: string;
  subtitle: string;
  text: string;
}) {
  return (
    <div className="bg-bg-secondary border border-border p-5">
      <div className="flex items-center gap-3 mb-2">
        <span className="font-mono text-[10px] text-accent-green tracking-[1.5px] bg-accent-green-soft px-2 py-1 font-semibold">
          {tier}
        </span>
        <h3 className="font-sans text-[14px] font-semibold">{title}</h3>
        <span className="font-mono text-[11px] text-text-dim">— {subtitle}</span>
      </div>
      <p className="font-sans text-[13px] text-text-muted leading-relaxed">
        {text}
      </p>
    </div>
  );
}

function AgentCard({
  codename,
  role,
  icon: Icon,
  text,
}: {
  codename: string;
  role: string;
  icon: React.ElementType;
  text: string;
}) {
  return (
    <div className="bg-bg-secondary border border-border p-5">
      <div className="flex items-center gap-3 mb-3">
        <Icon size={16} className="text-accent-green" />
        <span className="font-mono text-[11px] tracking-[2px] font-bold text-accent-green bg-accent-green-soft px-2 py-1">
          {codename}
        </span>
        <span className="font-sans text-[13px] font-semibold">{role}</span>
      </div>
      <p className="font-sans text-[12px] text-text-muted leading-relaxed">
        {text}
      </p>
    </div>
  );
}

function BacktestMetric({
  label,
  value,
  icon: Icon,
  green = false,
  red = false,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  green?: boolean;
  red?: boolean;
}) {
  return (
    <div className="bg-bg-secondary border border-border p-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className="text-text-dim" />
        <span className="font-mono text-[10px] text-text-dim tracking-[1.5px]">
          {label}
        </span>
      </div>
      <span
        className={`font-mono text-xl font-bold ${
          red ? "text-accent-red" : green ? "text-accent-green" : "text-text"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
