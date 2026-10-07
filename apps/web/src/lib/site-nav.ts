import { BLOG_CATEGORIES, categoryPath } from "@/lib/blog-taxonomy";
import { TOOL_BY_ID, type ToolId } from "@/lib/tools/registry";

/**
 * The public site's map. The top nav, the mobile sheet, the footer and the
 * search palette all read from here, so a new page is added once and shows
 * up everywhere it should.
 */

export type NavLink = {
  label: string;
  href: string;
  /** One line under the label in menus and search results. */
  blurb?: string;
  /** Short tag shown beside the label, e.g. "New". */
  badge?: string;
};

export type NavSection = {
  id: "research" | "tools" | "data" | "outpick";
  label: string;
  /** Where the section's own heading links to. */
  href: string;
  groups: { label: string; links: NavLink[] }[];
  /** The one thing the menu should push. */
  feature?: NavLink & { cta: string };
};

export const CHALLENGE_LINK: NavLink = {
  label: "Beat the S&P 500",
  href: "/tools/beat-the-sp-500",
  blurb: "Pick 15 stocks. We score them against the index for ten years.",
  badge: "Game",
};

/** How the calculators group on the tools page and in the menu. */
export const TOOL_GROUPS: { label: string; ids: ToolId[] }[] = [
  {
    label: "Value a business",
    ids: [
      "intrinsic-value-calculator",
      "free-cash-flow-worksheet",
      "profit-margin-calculator",
      "competitive-advantage-worksheet",
    ],
  },
  {
    label: "Size and risk",
    ids: ["downside-risk-worksheet", "concentrated-portfolio-calculator"],
  },
];

function toolLink(id: ToolId): NavLink {
  const t = TOOL_BY_ID[id];
  return { label: t.h1, href: t.path, blurb: t.subtitle };
}

export const NAV_SECTIONS: NavSection[] = [
  {
    id: "research",
    label: "Research",
    href: "/blog",
    groups: [
      {
        label: "Topics",
        links: BLOG_CATEGORIES.map((c) => ({
          label: c.title,
          href: categoryPath(c),
          blurb: c.description,
        })),
      },
    ],
    feature: {
      label: "Every article",
      href: "/blog",
      blurb: "The full archive, newest first, sorted into topics.",
      cta: "Browse the blog",
    },
  },
  {
    id: "tools",
    label: "Free tools",
    href: "/tools",
    groups: TOOL_GROUPS.map((g) => ({ label: g.label, links: g.ids.map(toolLink) })),
    feature: { ...CHALLENGE_LINK, cta: "Enter the challenge" },
  },
  {
    id: "data",
    label: "Data",
    href: "/companies",
    groups: [
      {
        label: "Company data",
        links: [
          {
            label: "Company directory",
            href: "/companies",
            blurb: "Headcount, revenue and revenue per employee for every company we track.",
          },
          {
            label: "Revenue per employee leaderboard",
            href: "/workforce",
            blurb: "Who earns the most per person, and who grows sales faster than hiring.",
          },
        ],
      },
    ],
    feature: {
      label: "Look up a company",
      href: "/companies",
      blurb: "Search by ticker or name for year by year headcount from the 10-K.",
      cta: "Search companies",
    },
  },
  {
    id: "outpick",
    label: "Outpick",
    href: "/strategy",
    groups: [
      {
        label: "The service",
        links: [
          { label: "How we invest", href: "/strategy", blurb: "The rules behind every pick." },
          { label: "Track record", href: "/track-record", blurb: "Every trade in the live book, losers included." },
          { label: "Sample research", href: "/#sample-research", blurb: "Read a real research note before paying." },
          { label: "Pricing", href: "/pricing" },
        ],
      },
      {
        label: "More",
        links: [
          { label: "Market Note", href: "/market-note", blurb: "The free weekly email." },
          { label: "FAQ", href: "/faq" },
          { label: "What we are not", href: "/what-we-are-not" },
        ],
      },
    ],
  },
];

/** Every tool page, challenge first. */
export const ALL_TOOL_LINKS: NavLink[] = [
  CHALLENGE_LINK,
  ...TOOL_GROUPS.flatMap((g) => g.ids.map(toolLink)),
];
