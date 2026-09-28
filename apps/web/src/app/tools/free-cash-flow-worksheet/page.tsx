import { FreeCashFlowWorksheet } from "@/components/tools/free-cash-flow-worksheet";
import { ToolShell } from "@/components/tools/tool-shell";
import { buildToolMetadata } from "@/lib/tools/metadata";
import { TOOL_BY_ID } from "@/lib/tools/registry";

const tool = TOOL_BY_ID["free-cash-flow-worksheet"];

export async function generateMetadata(props: {
  searchParams: Promise<{ ticker?: string | string[] }>;
}) {
  return buildToolMetadata(tool, await props.searchParams);
}

export default function FreeCashFlowWorksheetPage() {
  return (
    <ToolShell tool={tool}>
      <FreeCashFlowWorksheet />
    </ToolShell>
  );
}
