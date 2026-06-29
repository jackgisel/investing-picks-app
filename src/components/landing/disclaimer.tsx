export function Disclaimer() {
  return (
    <section className="border-b border-border">
      <div className="container-op py-16">
        <div className="bg-bg-secondary border border-border p-8">
          <h4 className="font-mono text-[10px] text-accent-red tracking-[2px] mb-3.5">
            IMPORTANT DISCLAIMER
          </h4>
          <p className="font-sans text-[12px] text-text-dim leading-relaxed">
            Outpick is an independent educational publication — not a registered
            investment adviser, broker-dealer, or financial institution. All
            content is for informational and educational purposes only and does
            not constitute investment advice, a recommendation, or an offer to
            buy or sell any securities. The Publisher holds positions in
            securities discussed and may buy or sell at any time without notice.
            Past performance is not indicative of future results. All investments
            carry risk, including the possible loss of principal. You are solely
            responsible for your own investment decisions and outcomes. Do not
            rely on this Service as the sole basis for any investment decision.
            Always conduct your own research and consult qualified professionals
            before investing. By using this Service, you agree to our{" "}
            <a href="/terms" className="text-accent-green hover:underline">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="/privacy" className="text-accent-green hover:underline">
              Privacy Policy
            </a>
            , including limitations of liability and your assumption of all
            investment risk.
          </p>
        </div>
      </div>
    </section>
  );
}
