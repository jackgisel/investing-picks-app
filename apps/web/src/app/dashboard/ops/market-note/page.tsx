import { redirect } from "next/navigation";

import { communicationHref } from "@/lib/communication";

export default function MarketNoteRedirect() {
  redirect(communicationHref("monday-market-note"));
}
