import { DownsideRiskWorksheet } from "@/components/tools/downside-risk-worksheet";
import { ToolShell } from "@/components/tools/tool-shell";
import { buildToolMetadata } from "@/lib/tools/metadata";
import { TOOL_BY_ID } from "@/lib/tools/registry";

const tool = TOOL_BY_ID["downside-risk-worksheet"];

export async function generateMetadata(props: {
  searchParams: Promise<{ ticker?: string | string[] }>;
}) {
  return buildToolMetadata(tool, await props.searchParams);
}

export default function DownsideRiskWorksheetPage() {
  return (
    <ToolShell tool={tool}>
      <DownsideRiskWorksheet />
    </ToolShell>
  );
}
