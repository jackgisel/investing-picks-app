import { ProfitMarginCalculator } from "@/components/tools/profit-margin-calculator";
import { ToolShell } from "@/components/tools/tool-shell";
import { buildToolMetadata } from "@/lib/tools/metadata";
import { TOOL_BY_ID } from "@/lib/tools/registry";

const tool = TOOL_BY_ID["profit-margin-calculator"];

export async function generateMetadata(props: {
  searchParams: Promise<{ ticker?: string | string[] }>;
}) {
  return buildToolMetadata(tool, await props.searchParams);
}

export default function ProfitMarginCalculatorPage() {
  return (
    <ToolShell tool={tool}>
      <ProfitMarginCalculator />
    </ToolShell>
  );
}
