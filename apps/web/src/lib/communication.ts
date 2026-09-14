/**
 * Admin Communication surface: one page, five tabs.
 *
 * The old standalone ops URLs still exist as redirects so bookmarks, ops
 * emails, and magic-link `?next=` values land on the right tab instead of 404.
 */

export const COMMUNICATION_TABS = [
  { id: "friday-stock-pick", label: "Friday Stock Pick" },
  { id: "friday-portfolio-review", label: "Friday Portfolio Review" },
  { id: "sunday-market-preview", label: "Sunday Market Preview" },
  { id: "x-threads", label: "X Threads" },
  { id: "product-updates", label: "Product Updates" },
] as const;

export type CommunicationTabId = (typeof COMMUNICATION_TABS)[number]["id"];

export const DEFAULT_COMMUNICATION_TAB: CommunicationTabId = "friday-stock-pick";

export const COMMUNICATION_PATH = "/dashboard/ops/communication";

/** Old admin URLs → the tab they now live on. */
export const LEGACY_COMMUNICATION_REDIRECTS: Readonly<
  Record<string, CommunicationTabId>
> = {
  "/dashboard/dca": "friday-stock-pick",
  "/dashboard/ops/weekly-review": "friday-portfolio-review",
  "/dashboard/ops/market-note": "sunday-market-preview",
  "/dashboard/ops/x-threads": "x-threads",
  "/dashboard/ops/product-updates": "product-updates",
};

export function isCommunicationTabId(value: string): value is CommunicationTabId {
  return COMMUNICATION_TABS.some((tab) => tab.id === value);
}

export function parseCommunicationTab(
  raw: string | null | undefined,
): CommunicationTabId {
  if (raw && isCommunicationTabId(raw)) return raw;
  return DEFAULT_COMMUNICATION_TAB;
}

export function communicationHref(
  tab: CommunicationTabId = DEFAULT_COMMUNICATION_TAB,
): string {
  return `${COMMUNICATION_PATH}?tab=${tab}`;
}

export function legacyCommunicationRedirect(pathname: string): string | null {
  const tab = LEGACY_COMMUNICATION_REDIRECTS[pathname];
  return tab ? communicationHref(tab) : null;
}
