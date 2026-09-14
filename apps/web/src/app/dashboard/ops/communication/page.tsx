import type { Metadata } from "next";
import { Suspense } from "react";

import { CommunicationPage } from "@/components/dashboard/communication-page";

export const metadata: Metadata = { title: "Communication" };

export default function OpsCommunicationPage() {
  return (
    <Suspense
      fallback={
        <div className="data-card text-sm text-text-muted">Loading…</div>
      }
    >
      <CommunicationPage />
    </Suspense>
  );
}
