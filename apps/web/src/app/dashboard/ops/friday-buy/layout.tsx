import type { Metadata } from "next";

export const metadata: Metadata = { title: "Friday buy" };

export default function OpsFridayBuyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
