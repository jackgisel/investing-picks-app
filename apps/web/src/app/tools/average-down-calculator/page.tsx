import { AverageDownCalculator } from "@/components/tools/average-down-calculator";
import { AverageDownCalculatorArticle } from "@/components/tools/average-down-calculator-article";
import { ToolShell } from "@/components/tools/tool-shell";
import {
  buildToolJsonLd,
  buildToolMetadata,
  toolBreadcrumbItems,
} from "@/lib/tools/metadata";
import { TOOL_BY_ID } from "@/lib/tools/registry";

const tool = TOOL_BY_ID["average-down-calculator"];

export async function generateMetadata(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return buildToolMetadata(tool, await props.searchParams);
}

export default async function AverageDownCalculatorPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const jsonLd = buildToolJsonLd(tool);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ToolShell
        tool={tool}
        breadcrumbs={toolBreadcrumbItems(tool)}
        article={<AverageDownCalculatorArticle />}
      >
        <AverageDownCalculator initialQuery={searchParams} />
      </ToolShell>
    </>
  );
}
