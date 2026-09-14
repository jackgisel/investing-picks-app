"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { FridayPortfolioReviewPanel } from "@/components/dashboard/friday-portfolio-review-panel";
import { FridayStockPickPanel } from "@/components/dashboard/friday-stock-pick-panel";
import { ProductUpdatesPanel } from "@/components/dashboard/product-updates-panel";
import { SundayMarketPreviewPanel } from "@/components/dashboard/sunday-market-preview-panel";
import { TabPanel, Tabs } from "@/components/dashboard/tabs";
import { XThreadsPanel } from "@/components/dashboard/x-threads-panel";
import {
  COMMUNICATION_TABS,
  parseCommunicationTab,
  type CommunicationTabId,
} from "@/lib/communication";

export function CommunicationPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = parseCommunicationTab(searchParams.get("tab"));

  function setTab(next: CommunicationTabId) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Communication</h1>
        <p className="mt-1 max-w-[640px] font-sans text-[13px] leading-relaxed text-text-dim">
          Friday pick and portfolio review, Sunday market preview, X threads,
          and product updates — one queue.
        </p>
      </div>

      <div>
        <Tabs
          tabs={COMMUNICATION_TABS}
          value={tab}
          onChange={setTab}
          label="Communication"
        />
        {tab === "friday-stock-pick" && (
          <div className="pt-5">
            <TabPanel id="friday-stock-pick">
              <FridayStockPickPanel />
            </TabPanel>
          </div>
        )}
        {tab === "friday-portfolio-review" && (
          <div className="pt-5">
            <TabPanel id="friday-portfolio-review">
              <FridayPortfolioReviewPanel />
            </TabPanel>
          </div>
        )}
        {tab === "sunday-market-preview" && (
          <div className="pt-5">
            <TabPanel id="sunday-market-preview">
              <SundayMarketPreviewPanel />
            </TabPanel>
          </div>
        )}
        {tab === "x-threads" && (
          <div className="pt-5">
            <TabPanel id="x-threads">
              <XThreadsPanel />
            </TabPanel>
          </div>
        )}
        {tab === "product-updates" && (
          <div className="pt-5">
            <TabPanel id="product-updates">
              <ProductUpdatesPanel />
            </TabPanel>
          </div>
        )}
      </div>
    </div>
  );
}
