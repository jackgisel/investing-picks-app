import type { Metadata } from "next";

// The page is a client component, so the title has to come from a layout.
// Same reason as app/dashboard/settings/layout.tsx.
export const metadata: Metadata = {
  title: "Feature requests",
};

export default function FeatureRequestsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
