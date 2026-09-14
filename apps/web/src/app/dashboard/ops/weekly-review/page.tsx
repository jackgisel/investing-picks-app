import { redirect } from "next/navigation";

import { communicationHref } from "@/lib/communication";

export default function WeeklyReviewRedirect() {
  redirect(communicationHref("friday-portfolio-review"));
}
