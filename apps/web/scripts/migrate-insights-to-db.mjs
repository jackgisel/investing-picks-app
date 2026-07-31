/**
 * One-time conversion of the hand-written .tsx research notes into `insight`
 * rows.
 *
 *   node scripts/migrate-insights-to-db.mjs            # convert + print, touch nothing
 *   node scripts/migrate-insights-to-db.mjs --seed     # write scripts/insights-seed.json
 *   node scripts/migrate-insights-to-db.mjs --write    # insert the seed (needs DATABASE_URL)
 *
 * The seed is committed and `--write` inserts from IT, not from the .tsx
 * sources. That split is the point: the sources are deleted in the same change
 * that adds this, so a migration that could only run while they existed would
 * be a migration that could never be re-run — including against a database
 * restored later.
 *
 * Two invariants this script exists to protect:
 *
 *  - **Slugs are copied verbatim.** `post_comment` addresses threads by
 *    (subject_type, subject_slug) with no foreign key, so regenerating a slug
 *    silently orphans every comment on that note.
 *  - **`email_sent_at` is set on insert.** These eight were announced months
 *    ago. The approve path refuses to send when that column is non-null, so
 *    filling it here is what makes it impossible to re-mail the list about a
 *    pick from April.
 */
import { readFileSync, readdirSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const here = dirname(fileURLToPath(import.meta.url));
const contentDir = join(here, "..", "src", "content", "insights");

/* ---------------------------- meta extraction ---------------------------- */

/**
 * Same brace-walk + evaluate the (now deleted) index generator used. The
 * metadata is a plain literal with no computed values, so this is a parse
 * rather than an execution of app code.
 */
function readMeta(src, file) {
  const start = src.indexOf("meta: {");
  if (start === -1) throw new Error(`${file}: no meta block`);
  let depth = 0;
  let end = -1;
  for (let i = src.indexOf("{", start); i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end === -1) throw new Error(`${file}: unterminated meta block`);
  return new Function(`return (${src.slice(src.indexOf("{", start), end)});`)();
}

/* ------------------------------ JSX → text ------------------------------- */

const ENTITIES = {
  "&ldquo;": "“",
  "&rdquo;": "”",
  "&lsquo;": "‘",
  "&rsquo;": "’",
  "&apos;": "’",
  "&mdash;": "—",
  "&ndash;": "–",
  "&hellip;": "…",
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
};

/**
 * Collapse a JSX text run to a single line.
 *
 * JSX source is indented for readability, so every paragraph arrives full of
 * newlines and leading spaces that are not part of the prose. `{" "}` is the
 * explicit-space escape the authors used at line ends and must become a real
 * space, not disappear.
 */
function text(jsx) {
  let out = jsx.replace(/\{"\s"\}/g, " ").replace(/\{" "\}/g, " ");
  out = out.replace(/<Strong>([\s\S]*?)<\/Strong>/g, (_, inner) => `**${squash(inner)}**`);
  out = out.replace(
    /<A\s+href="([^"]+)"\s*>([\s\S]*?)<\/A>/g,
    (_, href, inner) => `[${squash(inner)}](${href})`,
  );
  out = out.replace(/<em>([\s\S]*?)<\/em>/g, (_, inner) => `*${squash(inner)}*`);
  for (const [entity, char] of Object.entries(ENTITIES)) {
    out = out.split(entity).join(char);
  }
  const leftover = out.match(/<\/?[A-Za-z][^>]*>/g);
  if (leftover) {
    throw new Error(`unconverted JSX tag(s): ${[...new Set(leftover)].join(", ")}`);
  }
  return squash(out);
}

function squash(s) {
  return s.replace(/\s+/g, " ").trim();
}

/** Every `<LI>…</LI>` inside a block, in order. */
function listItems(block) {
  return [...block.matchAll(/<LI>([\s\S]*?)<\/LI>/g)].map((m) => text(m[1]));
}

function section(src, tag) {
  const m = src.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return m ? m[1] : null;
}

/**
 * The six-section body, as markdown.
 *
 * Walks the run between the TLDR and the disclaimer Callout in document order
 * rather than matching each element type separately — H2s, paragraphs and
 * lists interleave, and matching by type would reorder them.
 */
function toMarkdown(body) {
  const blocks = [];
  const pattern =
    /<Callout\b([^>]*)>([\s\S]*?)<\/Callout>|<H2>([\s\S]*?)<\/H2>|<P>([\s\S]*?)<\/P>|<UL>([\s\S]*?)<\/UL>/g;
  let m;
  while ((m = pattern.exec(body)) !== null) {
    if (m[1] !== undefined) {
      // A mid-body aside (SEZL has one: "What we are not arguing"). Rendered
      // as a blockquote whose first line is the bolded title — MarkdownProse
      // maps blockquote back to <Callout> and lifts that line into its title,
      // so the variant and heading survive the round trip rather than being
      // flattened into an untitled box.
      const title = (m[1].match(/title="([^"]*)"/) || [])[1];
      const paragraphs = [...m[2].matchAll(/<P>([\s\S]*?)<\/P>/g)].map((p) =>
        text(p[1]),
      );
      const lines = title ? [`**${title}**`, "", ...paragraphs] : paragraphs;
      blocks.push(lines.map((l) => (l ? `> ${l}` : ">")).join("\n"));
    } else if (m[3] !== undefined) blocks.push(`## ${text(m[3])}`);
    else if (m[4] !== undefined) blocks.push(text(m[4]));
    else if (m[5] !== undefined) {
      blocks.push(listItems(m[5]).map((li) => `- ${li}`).join("\n"));
    }
  }
  return blocks.join("\n\n");
}

function convert(file) {
  const src = readFileSync(join(contentDir, file), "utf8");
  const meta = readMeta(src, file);
  if (meta.slug !== file.replace(/\.tsx$/, "")) {
    throw new Error(`${file}: slug does not match filename`);
  }

  const lede = section(src, "Lede");
  const tldrBlock = section(src, "TLDR");
  const keyTakeaway = section(src, "KeyTakeaway");
  if (!lede) throw new Error(`${file}: no <Lede>`);
  if (!tldrBlock) throw new Error(`${file}: no <TLDR>`);
  if (!keyTakeaway) throw new Error(`${file}: no <KeyTakeaway>`);

  // The body runs from the TLDR to the DISCLAIMER Callout — matched on its
  // variant and title, not on the first `<Callout` found. Splitting at the
  // first one silently truncated SEZL, which carries a mid-body aside before
  // it and lost four of its six sections.
  //
  // The disclaimer itself is dropped on purpose: it is identical in all eight
  // and becomes a fixed template in the route, so it must not survive as
  // authored content an editor could delete from a single note.
  const afterTldr = src.slice(src.indexOf("</TLDR>") + "</TLDR>".length);
  const disclaimerAt = afterTldr.search(
    /<Callout\s+variant="warning"\s+title="Educational disclaimer">/,
  );
  if (disclaimerAt === -1) throw new Error(`${file}: no disclaimer <Callout>`);
  const bodyMd = toMarkdown(afterTldr.slice(0, disclaimerAt));

  const tldr = listItems(tldrBlock);
  if (tldr.length !== 5) {
    throw new Error(`${file}: expected 5 TLDR bullets, got ${tldr.length}`);
  }

  const takeawayP = section(keyTakeaway, "P");
  if (!takeawayP) throw new Error(`${file}: <KeyTakeaway> has no <P>`);

  return {
    slug: meta.slug,
    ticker: meta.ticker ?? null,
    post_type: meta.postType ?? "pick",
    status: "approved",
    title: meta.title,
    description: meta.description,
    lede: text(lede),
    tldr,
    body_md: bodyMd,
    key_takeaway: text(takeawayP),
    tags: meta.tags ?? [],
    reading_time: meta.readingTime ?? null,
    author: meta.author ?? null,
    quarter: meta.quarter ?? null,
    published_at: meta.publishedAt,
  };
}

/* --------------------------------- main ---------------------------------- */

const seedPath = join(here, "insights-seed.json");

function convertAll() {
  const files = readdirSync(contentDir).filter((f) => f.endsWith(".tsx")).sort();
  return files.map((f) => {
    try {
      return convert(f);
    } catch (e) {
      console.error(`FAILED ${f}: ${e.message}`);
      process.exit(1);
    }
  });
}

if (process.argv.includes("--seed")) {
  const rows = convertAll();
  writeFileSync(seedPath, `${JSON.stringify(rows, null, 2)}\n`);
  console.error(`wrote ${rows.length} notes to ${seedPath}`);
  process.exit(0);
}

if (!process.argv.includes("--write")) {
  console.log(JSON.stringify(convertAll(), null, 2));
  console.error(`\nDry run. --seed to snapshot, --write to insert the seed.`);
  process.exit(0);
}

const rows = JSON.parse(readFileSync(seedPath, "utf8"));

const { Pool } = await import("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

let inserted = 0;
for (const r of rows) {
  const { rowCount } = await pool.query(
    `INSERT INTO insight
       (slug, ticker, post_type, status, title, description, lede, tldr,
        body_md, key_takeaway, tags, reading_time, author, quarter,
        published_at, email_sent_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11::jsonb, $12,
             $13, $14, $15::timestamptz,
             -- Already announced. Non-null here is what makes the approve
             -- path refuse to mail these again.
             $15::timestamptz)
     ON CONFLICT (slug) DO NOTHING`,
    [
      r.slug, r.ticker, r.post_type, r.status, r.title, r.description, r.lede,
      JSON.stringify(r.tldr), r.body_md, r.key_takeaway, JSON.stringify(r.tags),
      r.reading_time, r.author, r.quarter, r.published_at,
    ],
  );
  inserted += rowCount;
  console.log(`${rowCount ? "inserted" : "skipped (exists)"}  ${r.slug}`);
}

console.log(`\n${inserted}/${rows.length} inserted.`);
await pool.end();
