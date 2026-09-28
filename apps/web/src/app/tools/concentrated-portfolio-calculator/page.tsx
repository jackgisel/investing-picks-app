import { ConcentratedPortfolioCalculator } from "@/components/tools/concentrated-portfolio-calculator";
import { ToolShell } from "@/components/tools/tool-shell";
import { buildToolMetadata } from "@/lib/tools/metadata";
import { TOOL_BY_ID } from "@/lib/tools/registry";

const tool = TOOL_BY_ID["concentrated-portfolio-calculator"];

export async function generateMetadata(props: {
  searchParams: Promise<{ ticker?: string | string[] }>;
}) {
  const searchParams = await props.searchParams;
  return buildToolMetadata(tool, searchParams);
}

export default function ConcentratedPortfolioCalculatorPage() {
  return (
    <ToolShell tool={tool} blogLinkPlacement="result">
      <ConcentratedPortfolioCalculator />
    </ToolShell>
  );
}
