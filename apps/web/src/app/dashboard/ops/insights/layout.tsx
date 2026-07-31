import type { Metadata } from "next";

// The page itself is a client component and cannot export metadata, so the
// title lives in a passthrough layout.
export const metadata: Metadata = { title: "Research notes" };

export default function OpsInsightsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
