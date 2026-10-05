#!/usr/bin/env node
/**
 * First draft of a blog post, written by Claude from live web research.
 *
 *   ANTHROPIC_API_KEY=... node scripts/draft-blog.mjs --keyword "earnings revision investing" --topic "how revisions tell you what changed"
 *
 * Writes src/content/blog/<slug>.tsx and prints the import line to add to
 * src/lib/blog.ts. It does NOT register the post, so nothing publishes until a
 * person reads the file, edits it, and adds the import in a PR.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { writeFileSync, existsSync } from "node:fs";
import { z } from "zod";

const MODEL = "claude-opus-5-5";
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith("--")) acc.push([a.slice(2), all[i + 1]]);
    return acc;
  }, []),
);
if (!args.keyword || !args.topic) {
  console.error('Usage: draft-blog.mjs --keyword "<target keyword>" --topic "<angle>"');
  process.exit(1);
}

const RULES = `## House writing rules
- Never use an em dash, an en dash, or a double hyphen as punctuation. Use a period, a comma, or a colon. For a range write "to".
- Do not use: delve, crucial, pivotal, robust, seamless, landscape, tapestry, testament, underscore, showcase, leverage (verb), navigate (figuratively), unlock, elevate, foster, game-changer, deep dive, in today's market.
- Do not write "not X, but Y" or "X isn't Y, it's Z". State the point.
- Do not force ideas into groups of three. Say "is" and "has", not "serves as" or "boasts".
- No opening throat-clearing and no closing summary that restates the article.
- American spelling.`;

const Schema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  title: z.string().min(20).max(90),
  description: z.string().min(100).max(170),
  keywords: z.array(z.string()).min(4).max(8),
  category: z.enum(["Strategy", "Education", "Performance", "Research", "Markets"]),
  tags: z.array(z.string()).min(3).max(6),
  readingTime: z.number().int().min(3).max(15),
  lede: z.string().min(120),
  tldr: z.string().min(120),
  sections: z
    .array(z.object({ heading: z.string(), paragraphs: z.array(z.string()).min(2).max(6) }))
    .min(4)
    .max(8),
  faq: z.array(z.object({ q: z.string(), a: z.string() })).min(3).max(5),
  keyTakeaway: z.string().min(80),
});

const client = new Anthropic();

async function research() {
  const messages = [
    {
      role: "user",
      content: `Research for a blog post. Keyword: ${args.keyword}. Angle: ${args.topic}. Find current, sourced facts, definitions and data a careful long-term investor would want, with source names and URLs. Mark anything unconfirmed as UNCONFIRMED. Facts only, no opinions.`,
    },
  ];
  for (let turn = 0; turn < 7; turn += 1) {
    const res = await client.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 8 }],
      messages,
    }).finalMessage();
    if (res.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: res.content });
      continue;
    }
    return res.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
  }
  throw new Error("Research did not finish");
}

const notes = await research();
const response = await client.messages.parse({
  model: MODEL,
  max_tokens: 32000,
  thinking: { type: "adaptive" },
  output_config: { effort: "high", format: zodOutputFormat(Schema) },
  system: `You write blog posts for Outpick, a stock-research publication that screens for businesses with improving fundamentals. Audience: intelligent long-term individual investors.

- 1,400 to 2,000 words across the sections. Plain, specific, unhurried.
- Outside facts only from RESEARCH. Cite sources in prose ("according to the SEC"). Never invent a statistic.
- Educational, never advice. No price targets, no urgency, no promises about returns.
- Do not mention Outpick returns or performance numbers.
- slug is kebab-case, derived from the title.

${RULES}`,
  messages: [
    { role: "user", content: `KEYWORD: ${args.keyword}\nANGLE: ${args.topic}\n\nRESEARCH:\n${notes}` },
  ],
});
const d = response.parsed_output;
if (!d) throw new Error(`No draft (stop_reason: ${response.stop_reason})`);

const all = JSON.stringify(d);
if (/[—–]|--/.test(all)) throw new Error("Draft contains a dash. Rerun.");

const out = `src/content/blog/${d.slug}.tsx`;
if (existsSync(out)) throw new Error(`${out} already exists`);
const j = (s) => JSON.stringify(s);
const today = new Date().toISOString().slice(0, 10);

const tsx = `import type { Article } from "@/lib/blog";
import {
  Prose,
  Lede,
  H2,
  P,
  KeyTakeaway,
  FAQList,
  TLDR,
} from "@/components/blog/prose";

// AI-drafted from web research. Review every claim and source before publishing.
const article: Article = {
  meta: {
    slug: ${j(d.slug)},
    title: ${j(d.title)},
    description: ${j(d.description)},
    keyword: ${j(args.keyword)},
    keywords: ${j([args.keyword, ...d.keywords.filter((k) => k !== args.keyword)])},
    publishedAt: ${j(today)},
    category: ${j(d.category)},
    tags: ${j(d.tags)},
    readingTime: ${d.readingTime},
    author: "Outpick Research",
  },
  Content: () => (
    <Prose>
      <Lede>{${j(d.lede)}}</Lede>

      <TLDR>
        <P>{${j(d.tldr)}}</P>
      </TLDR>
${d.sections
  .map(
    (s) => `
      <H2>{${j(s.heading)}}</H2>
${s.paragraphs.map((p) => `      <P>{${j(p)}}</P>`).join("\n")}`,
  )
  .join("\n")}

      <FAQList
        items={[
${d.faq.map((f) => `          { q: ${j(f.q)}, a: ${j(f.a)} },`).join("\n")}
          {
            q: "Is Outpick financial advice?",
            a: "No. Outpick is educational research, not financial advice; past performance is not indicative of future results. Every reader makes their own decisions about whether and how to act on the research.",
          },
        ]}
      />

      <KeyTakeaway>
        <P>{${j(d.keyTakeaway)}}</P>
      </KeyTakeaway>
    </Prose>
  ),
};

export default article;
`;
writeFileSync(out, tsx);
console.log(`Wrote ${out}\n\nTo publish after review, add to src/lib/blog.ts:\n  import ${d.slug.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase()).replace(/^[0-9]/, "_$&")} from "@/content/blog/${d.slug}";\nand add it to the articles list.`);
