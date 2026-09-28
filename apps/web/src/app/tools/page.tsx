import Link from "next/link";
import { buildToolsIndexMetadata } from "@/lib/tools/metadata";
import { TOOL_DEFINITIONS } from "@/lib/tools/registry";

export const metadata = buildToolsIndexMetadata();

export default function ToolsIndexPage() {
  return (
    <>
      <div className="container-op border-b border-border py-14 sm:py-16">
        <div className="max-w-[720px]">
          <p className="section-label">Free tools</p>
          <h1 className="section-title">Worksheets and calculators</h1>
          <p className="section-sub mb-0">
            Six public pages that run arithmetic on figures you type. No login on
            the math, no price targets, and no letter grades.
          </p>
        </div>
      </div>

      <section className="border-b border-border">
        <div className="container-op py-12 sm:py-16 max-w-[720px]">
          <ul className="space-y-8">
            {TOOL_DEFINITIONS.map((tool) => (
              <li key={tool.id}>
                <Link
                  href={tool.path}
                  className="group block rounded-soft border border-border bg-bg-secondary/30 px-6 py-6 sm:px-8 hover:border-border-strong transition-colors"
                >
                  <h2 className="font-sans text-[20px] font-bold text-text group-hover:opacity-90">
                    {tool.h1}
                  </h2>
                  <p className="font-sans text-[14px] text-text-muted leading-relaxed mt-2">
                    {tool.subtitle}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
