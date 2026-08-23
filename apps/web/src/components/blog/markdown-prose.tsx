import { Children, isValidElement, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { A, Callout, H2, H3, LI, OL, P, Prose, Strong, UL } from "./prose";

/**
 * A blockquote whose first paragraph is nothing but bold text is an aside with
 * a heading — `> **What we are not arguing**` — so lift that line into the
 * Callout's title instead of rendering it as a bold paragraph inside the box.
 *
 * This is what lets a titled `<Callout>` survive the trip through markdown.
 * Without it the mapping is lossy in one direction only: the component takes a
 * title, markdown has nowhere to put one, and every migrated aside would come
 * back as an untitled grey box.
 */
function splitCalloutTitle(children: ReactNode): {
  title?: string;
  body: ReactNode;
} {
  const nodes = Children.toArray(children).filter(
    (n) => typeof n !== "string" || n.trim() !== "",
  );
  const [first, ...rest] = nodes;
  if (!isValidElement<{ children?: ReactNode }>(first)) return { body: children };

  const inner = Children.toArray(first.props.children).filter(
    (n) => typeof n !== "string" || n.trim() !== "",
  );
  if (inner.length !== 1) return { body: children };

  const only = inner[0];
  if (!isValidElement<{ children?: ReactNode }>(only) || only.type !== Strong) {
    return { body: children };
  }

  const title = Children.toArray(only.props.children)
    .filter((n) => typeof n === "string")
    .join("");
  return title ? { title, body: rest } : { body: children };
}

/**
 * Render markdown using the same Prose primitives the articles used before
 * research notes moved into the database, so a stored note is visually
 * indistinguishable from the hand-written ones it replaced.
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
          blockquote: ({ children }) => {
            const { title, body } = splitCalloutTitle(children);
            return (
              <Callout variant="info" title={title}>
                {body}
              </Callout>
            );
          },
          table: ({ children }) => (
            <div className="my-8 max-w-[680px] overflow-x-auto">
              <table className="w-full border-collapse text-left">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="border-b border-border">{children}</thead>
          ),
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => (
            <tr className="border-b border-border/70 last:border-0">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="px-0 py-2.5 pr-6 font-mono text-[10px] font-medium uppercase tracking-[1.2px] text-text-dim">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-0 py-2.5 pr-6 font-sans text-[14px] tabular-nums text-text-muted">
              {children}
            </td>
          ),
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
