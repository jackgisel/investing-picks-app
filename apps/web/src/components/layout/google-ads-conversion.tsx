import {
  googleAdsConversionSnippet,
  type GoogleAdsConversionEvent,
} from "@/lib/google-ads";

export function GoogleAdsConversion(event: GoogleAdsConversionEvent) {
  return (
    <script
      id="google-ads-conversion"
      dangerouslySetInnerHTML={{ __html: googleAdsConversionSnippet(event) }}
    />
  );
}
