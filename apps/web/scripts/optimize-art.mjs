/**
 * Dithered-art asset pipeline for /public/art.
 *
 * Run from apps/web:
 *   node scripts/optimize-art.mjs          # (re)generate encodes + variants
 *   node scripts/optimize-art.mjs --check  # verify, no writes (part of `check`)
 *
 * The prints are indexed-colour dither (2–8 flat tones, no gradients). That
 * defeats every lossy encoder: `next/image` re-encoded /art/fuji.png (111KB)
 * as a 902KB WebP at w=1920 and each 400KB blog cover as a 450KB WebP, so the
 * optimiser was the single heaviest resource on /pricing, /blog and every
 * article. Palette PNG is the right container for this artwork, so the art
 * components serve these files straight from /public with a srcset and skip
 * the optimiser entirely.
 *
 * For every source PNG (anything not already a `-<width>w.png` variant) this
 * writes:
 *   - the source itself, re-encoded losslessly at the smallest palette bit
 *     depth that holds its colours (pixels are verified identical; the file
 *     is left alone if that ever fails);
 *   - `<name>-480w.png`, `<name>-750w.png`, `<name>-960w.png`: resized and
 *     re-dithered to four tones. Downscaling a dither produces intermediate
 *     colours; re-quantising restores the risograph texture at a fraction of
 *     the bytes (a 1200w cover is ~320KB lossless, its 750w variant ~68KB).
 *
 * Variants are committed rather than built on deploy so the runtime never
 * depends on the encoder. `--check` confirms every source has every variant
 * and each variant has the width its name claims; it reads PNG headers only
 * and needs no dependencies, so it runs in CI as part of `pnpm check`.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "url";

export const VARIANT_WIDTHS = [480, 750, 960];
const VARIANT_TONES = 4;
const VARIANT_RE = /-(\d+)w\.png$/;

const here = path.dirname(fileURLToPath(import.meta.url));
const ART_DIR = path.join(here, "..", "public", "art");

function walkPngs(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkPngs(full));
    else if (entry.isFile() && entry.name.endsWith(".png")) out.push(full);
  }
  return out.sort();
}

function variantPath(src, width) {
  return src.replace(/\.png$/, `-${width}w.png`);
}

/** Width/height from the IHDR chunk. Enough for --check without a decoder. */
function pngSize(file) {
  const fd = fs.openSync(file, "r");
  try {
    const head = Buffer.alloc(24);
    fs.readSync(fd, head, 0, 24, 0);
    if (head.toString("latin1", 1, 4) !== "PNG") throw new Error(`${file}: not a PNG`);
    return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
  } finally {
    fs.closeSync(fd);
  }
}

function sources() {
  return walkPngs(ART_DIR).filter((f) => !VARIANT_RE.test(f));
}

export function check() {
  const problems = [];
  for (const src of sources()) {
    const { width } = pngSize(src);
    for (const w of VARIANT_WIDTHS) {
      if (w >= width) continue;
      const variant = variantPath(src, w);
      const rel = path.relative(ART_DIR, variant);
      if (!fs.existsSync(variant)) {
        problems.push(`missing ${rel} — run: node scripts/optimize-art.mjs`);
        continue;
      }
      const got = pngSize(variant).width;
      if (got !== w) problems.push(`${rel} is ${got}px wide, expected ${w}`);
    }
  }
  const orphans = walkPngs(ART_DIR).filter((f) => {
    const m = VARIANT_RE.exec(f);
    return m && !fs.existsSync(f.replace(VARIANT_RE, ".png"));
  });
  for (const o of orphans) {
    problems.push(`${path.relative(ART_DIR, o)} has no source PNG — delete it`);
  }
  return problems;
}

/**
 * sharp is not a direct dependency: it ships with next as the optimiser we
 * are routing around, so resolve it through next's tree rather than adding a
 * native module to package.json for a script that runs a few times a year.
 */
async function loadSharp() {
  const require = createRequire(import.meta.url);
  const nextPkg = require.resolve("next/package.json");
  try {
    const sharpPath = createRequire(nextPkg).resolve("sharp");
    return (await import(sharpPath)).default;
  } catch (err) {
    throw new Error(
      `could not load sharp via next (${err.message}). Run pnpm install in apps/web.`,
    );
  }
}

function countColours(data, channels) {
  const seen = new Set();
  for (let i = 0; i < data.length; i += channels) {
    seen.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
    if (seen.size > 256) break;
  }
  return seen.size;
}

async function encodeLossless(sharp, buf) {
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  const colours = countColours(data, info.channels);
  if (colours > 256 || info.channels === 4) return null;
  // Palette bit depth follows the colour count: ≤2 → 1-bit, ≤4 → 2-bit,
  // ≤16 → 4-bit, else 8-bit. Try tighter first, keep the first identical one.
  for (const c of [colours, 16, 256]) {
    if (c < colours) continue;
    const out = await sharp(buf)
      .png({ palette: true, colours: c, dither: 0, compressionLevel: 9, effort: 10 })
      .toBuffer();
    const back = await sharp(out).raw().toBuffer({ resolveWithObject: true });
    if (back.info.channels === info.channels && back.data.equals(data)) return out;
  }
  return null;
}

async function encodeVariant(sharp, buf, width) {
  return sharp(buf)
    .resize({ width, kernel: "lanczos3" })
    .png({
      palette: true,
      colours: VARIANT_TONES,
      dither: 1.0,
      compressionLevel: 9,
      effort: 10,
    })
    .toBuffer();
}

function writeIfChanged(file, out) {
  if (fs.existsSync(file) && fs.readFileSync(file).equals(out)) return false;
  fs.writeFileSync(file, out);
  return true;
}

const kb = (n) => `${Math.round(n / 1024)}KB`;

async function generate() {
  const sharp = await loadSharp();
  let before = 0;
  let after = 0;
  for (const src of sources()) {
    const rel = path.relative(ART_DIR, src);
    const buf = fs.readFileSync(src);
    before += buf.length;
    const lossless = await encodeLossless(sharp, buf);
    let line = `${rel}: ${kb(buf.length)}`;
    if (lossless && lossless.length < buf.length) {
      writeIfChanged(src, lossless);
      after += lossless.length;
      line += ` → ${kb(lossless.length)} lossless`;
    } else {
      after += buf.length;
      line += lossless ? " (already minimal)" : " (kept: not palette-safe)";
    }
    const { width } = await sharp(buf).metadata();
    const sizes = [];
    for (const w of VARIANT_WIDTHS) {
      if (w >= width) continue;
      const out = await encodeVariant(sharp, buf, w);
      writeIfChanged(variantPath(src, w), out);
      sizes.push(`${w}w=${kb(out.length)}`);
    }
    console.log(`${line}; variants ${sizes.join(" ")}`);
  }
  console.log(`\nsources: ${kb(before)} → ${kb(after)}`);
  const problems = check();
  if (problems.length) {
    console.error(problems.join("\n"));
    process.exit(1);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (process.argv.includes("--check")) {
    const problems = check();
    if (problems.length) {
      console.error(`art variants out of date:\n  ${problems.join("\n  ")}`);
      process.exit(1);
    }
    console.log("art variants OK");
  } else {
    await generate();
  }
}
