import { redirect } from "next/navigation";

import { communicationHref } from "@/lib/communication";

export default function XThreadsRedirect() {
  redirect(communicationHref("x-threads"));
}
