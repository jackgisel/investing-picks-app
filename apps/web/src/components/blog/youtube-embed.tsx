import { A } from "@/components/blog/prose";
import { YouTubeFacade } from "@/components/blog/youtube-facade";
import { SITE_NAME, SITE_URL } from "@/lib/constants";

const WATCH_BASE = "https://www.youtube.com/watch?v=";
const EMBED_BASE = "https://www.youtube-nocookie.com/embed/";

/**
 * Accessible 16:9 YouTube player. Privacy-enhanced host, and the iframe itself
 * is only created on the first click (see YouTubeFacade) so the article does
 * not pay for the player script up front.
 * Optional VideoObject JSON-LD so the featured talk is eligible for video rich results.
 */
export function YouTubeEmbed({
  videoId,
  title,
  publishedAt,
}: {
  videoId: string;
  title: string;
  /** ISO date YYYY-MM-DD when the video went public */
  publishedAt?: string;
}) {
  const watchUrl = `${WATCH_BASE}${videoId}`;
  const embedUrl = `${EMBED_BASE}${videoId}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: title,
    description: title,
    embedUrl,
    contentUrl: watchUrl,
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    ...(publishedAt ? { uploadDate: publishedAt } : {}),
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
  };

  return (
    <figure className="my-10 max-w-[680px]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="relative aspect-video w-full overflow-hidden border border-border bg-bg-secondary">
        <YouTubeFacade videoId={videoId} title={title} embedUrl={embedUrl} />
      </div>
      <figcaption className="mt-3 font-sans text-[13px] text-text-dim leading-relaxed">
        Outpick on YouTube.{" "}
        <A href={watchUrl}>Open the video in a new tab</A>
        {" "}if the player does not load.
      </figcaption>
    </figure>
  );
}
