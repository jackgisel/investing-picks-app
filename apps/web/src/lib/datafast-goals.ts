import {
  DATAFAST_NEWSLETTER_SUBSCRIBE_GOAL,
  trackDatafastGoal,
} from "@/lib/datafast";

export function trackMarketNoteSubscribeSuccess(source: string): void {
  trackDatafastGoal(DATAFAST_NEWSLETTER_SUBSCRIBE_GOAL, { source });
}
