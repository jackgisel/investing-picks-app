import { googleAdsMeasurementId } from "@/lib/google-ads";

export function GoogleAdsScript() {
  const id = googleAdsMeasurementId();
  if (!id) return null;

  return (
    <>
      <script async src={`https://www.googletagmanager.com/gtag/js?id=${id}`} />
      <script
        id="google-ads-gtag"
        dangerouslySetInnerHTML={{
          __html: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${id}');`,
        }}
      />
    </>
  );
}
