import {
  googleAdsConversionParams,
  type GoogleAdsConversionEvent,
} from "@/lib/google-ads";

function conversionSnippet(event: GoogleAdsConversionEvent): string {
  const json = JSON.stringify(googleAdsConversionParams(event)).replace(
    /</g,
    "\\u003c",
  );
  return `gtag('event', 'conversion', ${json});`;
}

export function GoogleAdsConversion(event: GoogleAdsConversionEvent) {
  return (
    <script
      id="google-ads-conversion"
      dangerouslySetInnerHTML={{ __html: conversionSnippet(event) }}
    />
  );
}
