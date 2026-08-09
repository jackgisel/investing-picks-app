import type { Metadata } from "next";

// The page itself is a client component and cannot export metadata, so the
// title lives in a passthrough layout.
export const metadata: Metadata = { title: "Product updates" };

export default function OpsProductUpdatesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
