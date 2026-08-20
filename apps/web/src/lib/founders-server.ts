import { isFoundersDealActive } from "@/lib/portfolio";

/** Same calendar window the marketing UI uses. */
export async function isFoundersWindowActive(): Promise<boolean> {
  return isFoundersDealActive();
}
