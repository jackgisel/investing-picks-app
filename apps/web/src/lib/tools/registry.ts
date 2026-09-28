export type ToolId =
  | "concentrated-portfolio-calculator"
  | "profit-margin-calculator"
  | "free-cash-flow-worksheet"
  | "downside-risk-worksheet"
  | "intrinsic-value-calculator"
  | "competitive-advantage-worksheet";

export type ToolFaq = { q: string; a: string };

export type ToolDefinition = {
  id: ToolId;
  path: `/tools/${ToolId}`;
  eyebrow: string;
  h1: string;
  subtitle: string;
  /** Page title tag targets calculator / worksheet query */
  metaTitle: string;
  metaDescription: string;
  howToRead: string[];
  faq: ToolFaq[];
  relatedToolIds: ToolId[];
  /** Reserved blog slug; link renders only when published */
  blogSlug?: string;
  blogLinkLabel?: string;
  marketNoteSource: string;
  /** Extra essay link (published slugs only) */
  extraEssaySlug?: string;
  extraEssayLabel?: string;
};

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    id: "concentrated-portfolio-calculator",
    path: "/tools/concentrated-portfolio-calculator",
    eyebrow: "Free tool",
    h1: "Concentrated portfolio calculator",
    subtitle:
      "See equal weight and top heavy weight math for how many stocks you hold and how large the biggest one is.",
    metaTitle: "Concentrated portfolio calculator",
    metaDescription:
      "Free equal weight and top heavy portfolio calculator. Type how many stocks you hold and a move to test. No forecast, no ticker lookup.",
    howToRead: [
      "Equal weight mode splits the portfolio evenly across N names. The portfolio move is that weight times the move you typed.",
      "Top heavy mode keeps one largest weight you typed and spreads the rest evenly across the other names. Impact uses only the largest weight times the move.",
      "These are arithmetic exercises. They do not assume correlation, rebalancing, or how Outpick sizes the live book.",
      "Use the result to reason about concentration, not as a target portfolio.",
    ],
    faq: [
      {
        q: "What is a concentrated portfolio calculator?",
        a: "It is a simple weight math page. You type how many stocks you hold, optionally how large the biggest one is, and a percent move to test. The page shows the portfolio impact in percentage points.",
      },
      {
        q: "Does this tool recommend how many stocks to hold?",
        a: "No. It only prints weights and the arithmetic impact of a move you choose. It does not read our book or suggest a count.",
      },
      {
        q: "Can I enter a ticker?",
        a: "This page has no ticker field on purpose. It stays generic so it is not a comment on a single company.",
      },
    ],
    relatedToolIds: ["downside-risk-worksheet", "profit-margin-calculator"],
    blogSlug: "building-concentrated-stock-portfolios",
    blogLinkLabel: "Building concentrated stock portfolios",
    extraEssaySlug: "how-many-stocks-should-you-hold-to-beat-the-market",
    extraEssayLabel: "How many stocks should you hold to beat the market?",
    marketNoteSource: "tool-concentrated-portfolio-calculator",
  },
  {
    id: "profit-margin-calculator",
    path: "/tools/profit-margin-calculator",
    eyebrow: "Free tool",
    h1: "Profit margin calculator",
    subtitle:
      "Turn revenue and gross, operating, and net margins into dollar profit lines and the gap from gross to net.",
    metaTitle: "Profit margin calculator",
    metaDescription:
      "Free profit margin calculator for gross, operating, and net margins. Stack dollar profits from revenue you type. Optional snapshot margins for a ticker.",
    howToRead: [
      "Each dollar line is revenue times the margin you typed, expressed as a percent of revenue.",
      "The gap from gross to net is gross margin minus net margin in percentage points, not dollars.",
      "Optional prior year revenue and operating profit produce an incremental operating margin on the change only when both prior figures are filled in.",
      "Snapshot margins are trailing figures from our stored refresh. They are context you can overwrite, not a grade.",
    ],
    faq: [
      {
        q: "What does this profit margin calculator do?",
        a: "It converts three margin percentages and a revenue figure into dollar gross profit, operating profit, and net income, plus the spread between gross and net margins.",
      },
      {
        q: "Can I load margins for a ticker?",
        a: "Yes. When we have a fundamentals snapshot for the symbol, the three trailing margins can prefill. Revenue dollars are never implied from market cap or multiples.",
      },
      {
        q: "Is a wider gross to net gap bad?",
        a: "The page does not score margins. A wide gap simply means more cost sits between gross profit and net income for the figures you entered.",
      },
    ],
    relatedToolIds: [
      "competitive-advantage-worksheet",
      "free-cash-flow-worksheet",
    ],
    blogSlug: "how-to-assess-profit-margins",
    blogLinkLabel: "How to assess profit margins",
    marketNoteSource: "tool-profit-margin-calculator",
  },
  {
    id: "free-cash-flow-worksheet",
    path: "/tools/free-cash-flow-worksheet",
    eyebrow: "Free tool",
    h1: "Free cash flow worksheet",
    subtitle:
      "Trailing cash ratios from our stored snapshot when available, plus an owner earnings box that only uses numbers you type.",
    metaTitle: "Free cash flow worksheet",
    metaDescription:
      "Free cash flow worksheet with trailing cash ratios when we have a snapshot, and an owner earnings calculator from figures you enter.",
    howToRead: [
      "The ratio panel reads keys from the latest stored fundamentals row. A missing key shows as not in the snapshot rather than a zero.",
      "Owner earnings adds stock based compensation and subtracts maintenance capex from reported free cash flow you type. We do not store those adjustments.",
      "The owner earnings yield divides owner earnings by price times shares only when both price and shares are filled in. The label says it is on the numbers you typed.",
      "Nothing on this page flags a stock as cheap or expensive.",
    ],
    faq: [
      {
        q: "What is a free cash flow worksheet?",
        a: "It combines trailing cash ratios we already store with a small owner earnings calculator you control. Ratios appear when the snapshot contains the field.",
      },
      {
        q: "Why are some ratio rows blank?",
        a: "We only show a ratio when the key exists on the stored row. We do not call FMP from your browser or invent a substitute.",
      },
      {
        q: "Does owner earnings equal free cash flow?",
        a: "Not necessarily. The adjustment box lets you add back stock based compensation and subtract maintenance capex from the free cash flow figure you enter.",
      },
    ],
    relatedToolIds: [
      "intrinsic-value-calculator",
      "profit-margin-calculator",
    ],
    blogSlug: "free-cash-flow-stock-analysis",
    blogLinkLabel: "Free cash flow stock analysis",
    marketNoteSource: "tool-free-cash-flow-worksheet",
  },
  {
    id: "downside-risk-worksheet",
    path: "/tools/downside-risk-worksheet",
    eyebrow: "Free tool",
    h1: "Downside risk worksheet",
    subtitle:
      "See how a loss you type in one position moves the portfolio, beside balance sheet figures from our snapshot when we have them.",
    metaTitle: "Downside risk worksheet",
    metaDescription:
      "Free downside risk worksheet: position weight times decline equals portfolio impact. Altman Z and debt ratios when stored. No book filter copy.",
    howToRead: [
      "Portfolio impact is weight percent times decline percent, stated in percentage points of the whole portfolio.",
      "Balance sheet rows come from the stored snapshot. Altman Z includes his published zone cutoffs as reference text, not as an Outpick rule.",
      "The loss line does not wait on balance sheet data. Missing snapshot rows stay blank.",
      "The page does not state a probability of default or a forecast decline.",
    ],
    faq: [
      {
        q: "How do I use this downside risk worksheet?",
        a: "Type what percent of the portfolio one position is and what percent decline you want to stress. The page multiplies them to show portfolio impact in points.",
      },
      {
        q: "What is Altman Z on this page?",
        a: "It is the Z score we store from income statement and balance sheet lines. The captions beside it are Altman's published bands from his original papers.",
      },
      {
        q: "Does this read my brokerage account?",
        a: "No. Weights and declines are numbers you type. We do not pull positions from the Outpick book.",
      },
    ],
    relatedToolIds: [
      "concentrated-portfolio-calculator",
      "competitive-advantage-worksheet",
    ],
    blogSlug: "stock-downside-risk-analysis",
    blogLinkLabel: "Stock downside risk analysis",
    marketNoteSource: "tool-downside-risk-worksheet",
  },
  {
    id: "intrinsic-value-calculator",
    path: "/tools/intrinsic-value-calculator",
    eyebrow: "Free tool",
    h1: "Intrinsic value calculator",
    subtitle:
      "A five year free cash flow grid that turns assumptions you type into value per share, with no upside call.",
    metaTitle: "Intrinsic value calculator",
    metaDescription:
      "Free intrinsic value calculator: five year growing cash flow, terminal value, and a 3×3 sensitivity grid. Arithmetic only, not a price target.",
    howToRead: [
      "Each grid cell is value per share under a growth and discount pair. The center uses your inputs; neighbors step growth two points and discount one point.",
      "Terminal growth must stay below the discount rate or the cell stays empty.",
      "Optional snapshot context may show revenue growth or free cash flow to firm. Those fields do not fill the assumption boxes automatically except FCF when present and confirmed.",
      "The price row mirrors what you typed. The page does not label a stock undervalued or overvalued.",
    ],
    faq: [
      {
        q: "Is this intrinsic value calculator a price target?",
        a: "No. It runs the arithmetic you specify on free cash flow, growth, discount, and terminal assumptions. It is not a recommendation.",
      },
      {
        q: "Why a 3×3 grid?",
        a: "Small steps around your growth and discount inputs show how sensitive value per share is without extending the model beyond five explicit years plus terminal value.",
      },
      {
        q: "Where do discount rate and share count come from?",
        a: "You type them. We do not store a cost of capital or diluted share count on the public snapshot this page uses.",
      },
    ],
    relatedToolIds: ["free-cash-flow-worksheet", "profit-margin-calculator"],
    blogSlug: "how-to-calculate-intrinsic-value",
    blogLinkLabel: "How to calculate intrinsic value",
    marketNoteSource: "tool-intrinsic-value-calculator",
  },
  {
    id: "competitive-advantage-worksheet",
    path: "/tools/competitive-advantage-worksheet",
    eyebrow: "Free tool",
    h1: "Competitive advantage worksheet",
    subtitle:
      "Trailing profitability from our snapshot beside a moat checklist you fill in, with no moat grade.",
    metaTitle: "Competitive advantage worksheet",
    metaDescription:
      "Free competitive advantage worksheet: moat checklist plus trailing margins and returns when we have a snapshot. No score, no wide/narrow label.",
    howToRead: [
      "Checking a moat box records your judgment. It does not add points or compute a score.",
      "Figures are trailing snapshot fields when present. Sector is a label only, with no peer rank.",
      "A missing figure is shown as not in the snapshot, not as zero.",
      "High margins alone do not prove a moat on this page.",
    ],
    faq: [
      {
        q: "What is a competitive advantage worksheet?",
        a: "It places profitability and growth figures next to a short checklist of moat sources you mark yourself, so story and numbers can be read together.",
      },
      {
        q: "Does this page score economic moat?",
        a: "No. There is no wide, narrow, or none label and no composite grade.",
      },
      {
        q: "Can I use it without a ticker?",
        a: "Yes. The checklist always works. Figures appear when we have a stored row for the symbol you enter.",
      },
    ],
    relatedToolIds: ["profit-margin-calculator", "downside-risk-worksheet"],
    blogSlug: "how-to-analyze-competitive-advantage",
    blogLinkLabel: "How to analyze competitive advantage",
    marketNoteSource: "tool-competitive-advantage-worksheet",
  },
];

export const TOOL_BY_ID: Record<ToolId, ToolDefinition> = Object.fromEntries(
  TOOL_DEFINITIONS.map((t) => [t.id, t]),
) as Record<ToolId, ToolDefinition>;

export const TOOL_PATHS = TOOL_DEFINITIONS.map((t) => t.path);

export function getToolById(id: string): ToolDefinition | undefined {
  return TOOL_BY_ID[id as ToolId];
}

export function isToolId(id: string): id is ToolId {
  return id in TOOL_BY_ID;
}
