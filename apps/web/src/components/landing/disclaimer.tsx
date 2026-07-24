export function Disclaimer() {
  return (
    <section className="border-b border-border">
      <div className="container-op py-16">
        <div className="soft-card">
          <h4 className="font-sans text-[11px] font-bold tracking-[0.14em] uppercase text-accent-coral mb-3.5">
            Important disclaimer
          </h4>
          <p className="font-sans text-[13px] text-text-dim leading-relaxed">
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
            <a href="/terms" className="text-text font-semibold underline underline-offset-2 hover:opacity-70">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="/privacy" className="text-text font-semibold underline underline-offset-2 hover:opacity-70">
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
