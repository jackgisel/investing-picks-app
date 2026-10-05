/**
 * Admin Communication surface.
 *
 * The page is a week desk. A `?piece=` query opens one editor. Old tab query
 * values and the retired standalone URLs still land on the right piece.
 */

export const COMMUNICATION_PIECES = [
  {
    id: "monday-market-note",
    label: "Monday market note",
    audience: "Free",
    when: "Monday 6:00 AM PT",
    ifYouDont: "If you do not confirm it, Monday's send does not go out.",
    onCalendar: true,
  },
  {
    id: "market-analysis",
    label: "Market analysis",
    audience: "Free",
    when: "The 1st and the 15th, 8:00 AM PT",
    ifYouDont: "If you do not confirm it, that half of the month does not go out.",
    onCalendar: true,
  },
  {
    id: "pick-spotlight",
    label: "Pick spotlight",
    audience: "Free",
    when: "Wednesday 8:00 AM PT",
    ifYouDont: "If you do not confirm it, Wednesday's letter does not go out.",
    onCalendar: true,
  },
  {
    id: "friday-stock-pick",
    label: "Friday stock pick",
    audience: "Paid",
    when: "Every other Friday, when the research note is approved",
    ifYouDont: "If the note is not approved, subscribers are not mailed.",
    onCalendar: true,
  },
  {
    id: "x",
    label: "X",
    audience: "X",
    when: "Weekdays, three graphics through the day",
    ifYouDont:
      "A graphic posts at its time unless you reject it. An earnings chart posts after its review window unless you reject it.",
    onCalendar: true,
  },
  {
    id: "product-updates",
    label: "Product updates",
    audience: "Free",
    when: "Whenever you send one",
    ifYouDont: "Nothing goes out until you send it.",
    onCalendar: false,
  },
  {
    id: "invites",
    label: "Invites",
    audience: "Free",
    when: "Whenever you send one",
    ifYouDont: "Nothing goes out until you send it.",
    onCalendar: false,
  },
] as const;

export type CommunicationPieceId = (typeof COMMUNICATION_PIECES)[number]["id"];

export const COMMUNICATION_PATH = "/dashboard/ops/communication";

const LEGACY_TABS: Record<string, CommunicationPieceId | null> = {
  "friday-stock-pick": "friday-stock-pick",
  "friday-portfolio-review": null,
  "sunday-market-preview": "monday-market-note",
  "x-threads": "x",
  "income-visuals": "x",
  "campaign-drafts": null,
  "product-updates": "product-updates",
  invites: "invites",
};

/** Old admin URLs → the piece they now open. Null opens the week desk. */
export const LEGACY_COMMUNICATION_REDIRECTS: Readonly<
  Record<string, CommunicationPieceId | null>
> = {
  "/dashboard/dca": "friday-stock-pick",
  "/dashboard/ops/weekly-review": null,
  "/dashboard/ops/market-note": "monday-market-note",
  "/dashboard/ops/x-threads": "x",
  "/dashboard/ops/product-updates": "product-updates",
};

export function isCommunicationPieceId(value: string): value is CommunicationPieceId {
  return COMMUNICATION_PIECES.some((piece) => piece.id === value);
}

export function communicationPiece(id: CommunicationPieceId) {
  const piece = COMMUNICATION_PIECES.find((item) => item.id === id);
  if (!piece) throw new Error(`Unknown communication piece ${id}`);
  return piece;
}

/** `piece` wins. An old `tab` value still opens the piece it became. */
export function parseCommunicationPiece(
  piece: string | null | undefined,
  tab: string | null | undefined,
): CommunicationPieceId | null {
  if (piece && isCommunicationPieceId(piece)) return piece;
  if (tab && Object.prototype.hasOwnProperty.call(LEGACY_TABS, tab)) {
    return LEGACY_TABS[tab];
  }
  return null;
}

export function communicationHref(piece?: CommunicationPieceId | null): string {
  if (!piece) return COMMUNICATION_PATH;
  return `${COMMUNICATION_PATH}?piece=${piece}`;
}

export function legacyCommunicationRedirect(pathname: string): string | null {
  if (!Object.prototype.hasOwnProperty.call(LEGACY_COMMUNICATION_REDIRECTS, pathname)) {
    return null;
  }
  return communicationHref(LEGACY_COMMUNICATION_REDIRECTS[pathname]);
}
