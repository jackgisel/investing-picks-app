import {
  addDays,
  isoWeekKeyFromYmd,
  nextAnalysisSend,
  nextWednesday,
  pacificParts,
  ymdString,
} from "@/lib/comm-calendar";
import { claimDispatch, releaseDispatch } from "@/lib/email-dispatch";
import { sendMarketNoteIssueEmail } from "@/lib/email";
import { generateAnalysisDraft, generateSpotlightDraft } from "@/lib/editorial-ai";
import { chooseSpotlightHolding } from "@/lib/editorial-copy";
import {
  claimEditorialForSend,
  ensureEditorialIssue,
  getEditorialByPeriod,
  getEditorialIssue,
  latestSpotlightTicker,
  saveEditorialIssue,
  type EditorialIssue,
  type EditorialKind,
} from "@/lib/editorial-issue";
import { fetchBookPositions } from "@/lib/held-tickers";
import { listActiveSubscribers } from "@/lib/market-note";
import { fetchThemeWorkforce } from "@/lib/income-visual/server";

/** The analysis is drafted this many days before it sends, so its research is fresh. */
const ANALYSIS_DRAFT_LEAD_DAYS = 3;

const pct = (ratio: unknown): number | null =>
  typeof ratio === "number" ? Math.round(ratio * 1000) / 10 : null;

/**
 * Open the next analysis and spotlight, and have the model write each one.
 * Drafts are left unconfirmed; `mailIssue` refuses anything a person has not
 * confirmed. A failed draft is reported, never thrown, so one letter cannot
 * block the other.
 */
export async function prepareEditorialIssues(now = new Date()): Promise<{
  analysisId: string;
  spotlightId: string;
  ticker: string | null;
  analysisDrafted: boolean;
  spotlightDrafted: boolean;
  errors: string[];
}> {
  const parts = pacificParts(now);
  const analysis = nextAnalysisSend(parts);
  const wednesday = nextWednesday(parts);
  const weekKey = isoWeekKeyFromYmd(ymdString(wednesday));

  const analysisIssue = await ensureEditorialIssue({
    kind: "market_analysis",
    periodKey: analysis.periodKey,
    subject: `Market analysis — ${analysis.periodKey}`,
  });
  const spotlightIssue = await ensureEditorialIssue({
    kind: "pick_spotlight",
    periodKey: weekKey,
    subject: `Pick spotlight — ${weekKey}`,
  });

  const errors: string[] = [];
  const today = ymdString(parts);

  let analysisDrafted = false;
  const analysisDue =
    ymdString(analysis.when) <= ymdString(addDays(parts, ANALYSIS_DRAFT_LEAD_DAYS));
  if (analysisDue) {
    try {
      analysisDrafted = await draftAnalysisIfEmpty(analysisIssue, today);
    } catch (e) {
      errors.push(`analysis: ${e instanceof Error ? e.message : "draft failed"}`);
    }
  }

  let ticker = spotlightIssue.ticker;
  let spotlightDrafted = false;
  if (!spotlightIssue.sentAt && !spotlightIssue.bodyMd.trim()) {
    try {
      const filled = await fillSpotlight(spotlightIssue.id, today);
      ticker = filled?.ticker ?? ticker;
      spotlightDrafted = Boolean(filled);
    } catch (e) {
      errors.push(`spotlight: ${e instanceof Error ? e.message : "draft failed"}`);
    }
  }
  return {
    analysisId: analysisIssue.id,
    spotlightId: spotlightIssue.id,
    ticker,
    analysisDrafted,
    spotlightDrafted,
    errors,
  };
}

/** Have the model write the analysis when the row is still blank. Throws on failure. */
export async function draftAnalysisIfEmpty(
  issue: EditorialIssue,
  today: string,
): Promise<boolean> {
  if (issue.sentAt || issue.bodyMd.trim()) return false;
  const draft = await generateAnalysisDraft(issue.periodKey, today);
  return Boolean(await saveEditorialIssue(issue.id, { ...draft, ticker: null }));
}

async function fillSpotlight(id: string, today: string): Promise<EditorialIssue | null> {
  const positions = await fetchBookPositions();
  if (!positions) return null;
  const last = await latestSpotlightTicker();
  const chosen = chooseSpotlightHolding(positions, last);
  if (!chosen || chosen.pnlPct === null) return null;
  const rows = await fetchThemeWorkforce([chosen.ticker]);
  const row = rows?.find((r) => r.ticker === chosen.ticker);
  const draft = await generateSpotlightDraft({
    ticker: chosen.ticker,
    pnlPct: chosen.pnlPct,
    entryDate: chosen.entryDate,
    revenuePct: pct(row?.revenue_yoy),
    employeesPct: pct(row?.employees_yoy),
    openingsChange90d: pct(row?.openings_change_90d),
    today,
  });
  return saveEditorialIssue(id, { ...draft, ticker: chosen.ticker });
}

export type EditorialSendResult = {
  kind: EditorialKind;
  ok: boolean;
  sent: number;
  failed: number;
  total: number;
  skipped?: string;
};

const COPY: Record<EditorialKind, { eyebrow: string; disclaimer: string }> = {
  market_analysis: {
    eyebrow: "Market analysis",
    disclaimer:
      "This note is market commentary, not investment advice, and not a stock pick.",
  },
  pick_spotlight: {
    eyebrow: "A business we hold",
    disclaimer:
      "This letter is about a business we hold. It is not a recommendation to buy or sell.",
  },
};

export async function sendEditorialIssue(id: string): Promise<EditorialSendResult> {
  const empty = { sent: 0, failed: 0, total: 0 };
  const issue = await getEditorialIssue(id);
  if (!issue) return { kind: "market_analysis", ok: false, ...empty, skipped: "no such issue" };
  return mailIssue(issue);
}

export async function sendDueEditorial(
  kind: EditorialKind,
  periodKey: string,
): Promise<EditorialSendResult> {
  const issue = await getEditorialByPeriod(kind, periodKey);
  if (!issue) return { kind, ok: false, sent: 0, failed: 0, total: 0, skipped: "no issue" };
  return mailIssue(issue);
}

async function mailIssue(issue: EditorialIssue): Promise<EditorialSendResult> {
  const empty = { kind: issue.kind, sent: 0, failed: 0, total: 0 };
  if (issue.sentAt) return { ...empty, ok: false, skipped: "already sent" };
  if (!issue.confirmedAt) return { ...empty, ok: false, skipped: "not confirmed" };
  if (!issue.bodyMd.trim()) return { ...empty, ok: false, skipped: "no body" };

  const recipients = await listActiveSubscribers();
  if (recipients.length === 0) return { ...empty, ok: false, skipped: "no active subscribers" };

  if (!(await claimDispatch(issue.kind, issue.periodKey, recipients.length))) {
    return { ...empty, ok: false, skipped: "already dispatched" };
  }
  const claimed = await claimEditorialForSend(issue.id, recipients.length);
  if (!claimed) {
    await releaseDispatch(issue.kind, issue.periodKey);
    return { ...empty, ok: false, skipped: "no longer sendable" };
  }

  const copy = COPY[issue.kind];
  const CHUNK = 5;
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < recipients.length; i += CHUNK) {
    const results = await Promise.all(
      recipients.slice(i, i + CHUNK).map((recipient) =>
        sendMarketNoteIssueEmail({
          to: recipient.email,
          token: recipient.token,
          subject: claimed.subject,
          lede: null,
          bodyMd: claimed.bodyMd,
          weekKey: claimed.periodKey,
          eyebrow: copy.eyebrow,
          disclaimer: copy.disclaimer,
        }),
      ),
    );
    for (const result of results) {
      if (result.ok) sent += 1;
      else failed += 1;
    }
  }
  return { kind: issue.kind, ok: failed === 0, sent, failed, total: recipients.length };
}
