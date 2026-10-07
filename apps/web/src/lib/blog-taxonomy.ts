import taxonomy from "@/content/blog-taxonomy.json";
import type { PastelTone } from "@/lib/tones";

/**
 * Blog categories and their sub-categories.
 *
 * The list lives in JSON so `scripts/draft-blog.mjs` reads the same one the
 * site renders: a drafted post can only name a sub-category that has a page.
 * `lib/blog.ts` checks every registered post against it at module load, so a
 * post filed under a sub-category that does not exist fails the build instead
 * of silently vanishing from the category pages.
 */

export type BlogSubcategory = {
  slug: string;
  name: string;
  description: string;
};

export type BlogCategory = {
  name: string;
  slug: string;
  title: string;
  description: string;
  subcategories: BlogSubcategory[];
};

export const BLOG_CATEGORIES: readonly BlogCategory[] = taxonomy.categories;

export function getCategoryBySlug(slug: string): BlogCategory | undefined {
  return BLOG_CATEGORIES.find((c) => c.slug === slug);
}

export function getCategoryByName(name: string): BlogCategory | undefined {
  return BLOG_CATEGORIES.find((c) => c.name === name);
}

export function getSubcategory(
  category: BlogCategory | undefined,
  slug: string,
): BlogSubcategory | undefined {
  return category?.subcategories.find((s) => s.slug === slug);
}

export function categoryPath(category: BlogCategory): string {
  return `/blog/category/${category.slug}`;
}

export function subcategoryPath(
  category: BlogCategory,
  sub: BlogSubcategory,
): string {
  return `/blog/category/${category.slug}/${sub.slug}`;
}

/** Problems with a post's filing, or an empty list when it is filed correctly. */
export function filingErrors(meta: {
  slug: string;
  category: string;
  subcategory: string;
}): string[] {
  const category = getCategoryByName(meta.category);
  if (!category) return [`${meta.slug}: unknown category "${meta.category}"`];
  if (!getSubcategory(category, meta.subcategory)) {
    const allowed = category.subcategories.map((s) => s.slug).join(", ");
    return [
      `${meta.slug}: "${meta.subcategory}" is not a ${meta.category} sub-category (allowed: ${allowed})`,
    ];
  }
  return [];
}

const CATEGORY_TONES: Record<string, PastelTone> = {
  Strategy: "yellow",
  Education: "lilac",
  Research: "peach",
  Markets: "cyan",
  Performance: "mint",
};

/** Chip colour for a category name. */
export function categoryTone(category: string): PastelTone {
  return CATEGORY_TONES[category] ?? "peach";
}
