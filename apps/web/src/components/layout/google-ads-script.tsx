import {
  googleAdsBootstrapSource,
  googleAdsMeasurementId,
  googleAdsTagSrc,
} from "@/lib/google-ads";

/**
 * Server-rendered Google Ads tag for <head>.
 *
 * Google Ads verifies the tag by reading the raw HTML. A tag injected from
 * client JS after LCP never shows up there, so the conversion action stays
 * "unverified" and the goal reads as misconfigured. gtag.js is async, so it
 * does not block parsing.
 */
export function GoogleAdsScript() {
  const id = googleAdsMeasurementId();
  if (!id) return null;

  return (
    <>
      <script async src={googleAdsTagSrc(id)} />
      <script
        id="google-ads-gtag"
        dangerouslySetInnerHTML={{ __html: googleAdsBootstrapSource(id) }}
      />
    </>
  );
}
