import { NextResponse } from "next/server";
import { loadToolSnapshot } from "@/lib/tools-db";
import { getToolById, isToolId } from "@/lib/tools/registry";

export async function GET(
  request: Request,
  context: { params: Promise<{ toolId: string }> },
) {
  const { toolId } = await context.params;
  if (!isToolId(toolId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!getToolById(toolId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const ticker = url.searchParams.get("ticker") ?? "";
  if (!ticker.trim()) {
    return NextResponse.json({ error: "ticker required" }, { status: 400 });
  }

  const includePrice = url.searchParams.get("price") === "1";
  try {
    const snapshot = await loadToolSnapshot(toolId, ticker, { includePrice });
    if (!snapshot) {
      return NextResponse.json({ error: "Invalid ticker" }, { status: 400 });
    }
    return NextResponse.json(snapshot);
  } catch {
    return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  }
}
