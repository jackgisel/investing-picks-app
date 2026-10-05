import { redirect } from "next/navigation";

import { COMMUNICATION_PATH } from "@/lib/communication";

export default function WeeklyReviewRedirect() {
  redirect(COMMUNICATION_PATH);
}
