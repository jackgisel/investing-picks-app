import type { Metadata } from "next";

export const metadata: Metadata = { title: "X threads" };

export default function OpsXThreadsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
