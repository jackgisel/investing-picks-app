import type { Metadata } from "next";

export const metadata: Metadata = { title: "Weekly review" };

export default function OpsWeeklyReviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
