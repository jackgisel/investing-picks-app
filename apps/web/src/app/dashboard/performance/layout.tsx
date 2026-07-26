import type { Metadata } from "next";

// The page itself is a client component and cannot export metadata, so the
// title lives in a passthrough layout. Without this every dashboard tab read
// "Dashboard | Outpick" and bookmarks were indistinguishable.
export const metadata: Metadata = { title: "Performance" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
