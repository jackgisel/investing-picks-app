import { redirect } from "next/navigation";

import { communicationHref } from "@/lib/communication";

export default function ProductUpdatesRedirect() {
  redirect(communicationHref("product-updates"));
}
