import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { filingErrors } from "./blog-taxonomy";

const DIR = join(__dirname, "..", "content", "blog");

/**
 * lib/blog.ts rejects a misfiled post when the site builds, but CI does not
 * run `next build` and vitest cannot load the JSX post modules. Reading each
 * post's meta from source catches a missing or unknown sub-category before
 * merge instead of in the production deploy.
 */
describe("blog filing", () => {
  const posts = readdirSync(DIR).filter((f) => f.endsWith(".tsx"));

  it.each(posts)("%s is filed under a real sub-category", (file) => {
    const src = readFileSync(join(DIR, file), "utf8");
    const slug = src.match(/\bslug:\s*"([^"]+)"/)?.[1] ?? file;
    const category = src.match(/\bcategory:\s*"([^"]+)"/)?.[1] ?? "";
    const subcategory = src.match(/\bsubcategory:\s*"([^"]+)"/)?.[1] ?? "(missing)";
    expect(filingErrors({ slug, category, subcategory })).toEqual([]);
  });
});
