import { CompetitiveAdvantageWorksheet } from "@/components/tools/competitive-advantage-worksheet";
import { ToolShell } from "@/components/tools/tool-shell";
import { buildToolMetadata } from "@/lib/tools/metadata";
import { TOOL_BY_ID } from "@/lib/tools/registry";

const tool = TOOL_BY_ID["competitive-advantage-worksheet"];

export async function generateMetadata(props: {
  searchParams: Promise<{ ticker?: string | string[] }>;
}) {
  return buildToolMetadata(tool, await props.searchParams);
}

export default function CompetitiveAdvantageWorksheetPage() {
  return (
    <ToolShell tool={tool}>
      <CompetitiveAdvantageWorksheet />
    </ToolShell>
  );
}
