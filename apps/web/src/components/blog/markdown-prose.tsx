import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { A, Callout, H2, H3, LI, OL, P, Prose, Strong, UL } from "./prose";

/**
 * Render Haiku-generated markdown using the same Prose primitives the
 * hand-written TSX articles use, so dynamic posts at /insights look
 * identical to static articles at /blog.
 */
export function MarkdownProse({ markdown }: { markdown: string }) {
  return (
    <Prose>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <H2>{children}</H2>,
          h2: ({ children }) => <H2>{children}</H2>,
          h3: ({ children }) => <H3>{children}</H3>,
          h4: ({ children }) => <H3>{children}</H3>,
          p: ({ children }) => <P>{children}</P>,
          ul: ({ children }) => <UL>{children}</UL>,
          ol: ({ children }) => <OL>{children}</OL>,
          li: ({ children }) => <LI>{children}</LI>,
          strong: ({ children }) => <Strong>{children}</Strong>,
          em: ({ children }) => <em className="italic text-text">{children}</em>,
          a: ({ href, children }) => <A href={href || "#"}>{children}</A>,
          blockquote: ({ children }) => <Callout variant="info">{children}</Callout>,
          code: ({ children }) => (
            <code className="font-mono text-[13px] text-accent-green bg-bg-secondary px-1.5 py-0.5">
              {children}
            </code>
          ),
          hr: () => <hr className="my-8 border-border" />,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </Prose>
  );
}
