import { useQuery } from "@tanstack/react-query";

export type BlogPostType = "pick" | "quarterly_review";

export interface BlogPostSummary {
  slug: string;
  title: string;
  post_type: BlogPostType;
  ticker: string | null;
  quarter: string | null;
  published_at: string;
  excerpt: string;
}

export interface BlogPostsResponse {
  thesis_id: number;
  count: number;
  posts: BlogPostSummary[];
}

export interface BlogPostDetail {
  slug: string;
  title: string;
  post_type: BlogPostType;
  ticker: string | null;
  quarter: string | null;
  published_at: string;
  short_reason: string | null;
  content_md: string;
  trade: { date: string; side: "buy" | "sell"; ticker: string } | null;
}

export function useBlogPosts(type: "all" | BlogPostType = "all") {
  return useQuery<BlogPostsResponse>({
    queryKey: ["blog-posts", type],
    queryFn: async () => {
      const res = await fetch(`/api/data/blog?type=${type}`);
      if (!res.ok) throw new Error("Failed to fetch blog posts");
      return res.json();
    },
  });
}

export function useBlogPost(slug: string | undefined) {
  return useQuery<BlogPostDetail>({
    queryKey: ["blog-post", slug],
    queryFn: async () => {
      const res = await fetch(`/api/data/blog/${slug}`);
      if (!res.ok) throw new Error("Failed to fetch blog post");
      return res.json();
    },
    enabled: !!slug,
  });
}
