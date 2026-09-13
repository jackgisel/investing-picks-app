import { getStripe } from "@/lib/stripe";
import {
  googleAdsConversionFromSession,
  googleAdsConversionSendTo,
  parseCheckoutSessionId,
  type GoogleAdsConversionEvent,
} from "@/lib/google-ads";

export async function loadGoogleAdsCheckoutConversion(args: {
  userId: string;
  checkout: string | undefined;
  sessionId: string | undefined;
}): Promise<GoogleAdsConversionEvent | null> {
  if (args.checkout !== "success") return null;
  const sendTo = googleAdsConversionSendTo();
  if (!sendTo) return null;
  const sessionId = parseCheckoutSessionId(args.sessionId);
  if (!sessionId) return null;
  const stripe = getStripe();
  if (!stripe) return null;

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return googleAdsConversionFromSession(session, args.userId, sendTo);
  } catch (error) {
    console.warn("[Google Ads] Checkout session lookup failed", error);
    return null;
  }
}
