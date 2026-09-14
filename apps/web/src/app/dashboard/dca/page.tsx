import { redirect } from "next/navigation";

import { communicationHref } from "@/lib/communication";

export default function DcaRedirect() {
  redirect(communicationHref("friday-stock-pick"));
}
