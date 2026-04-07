export function Disclaimer() {
  return (
    <section className="border-b border-border">
      <div className="container-op py-16">
        <div className="bg-bg-secondary border border-border p-8">
          <h4 className="font-mono text-[10px] text-accent-red tracking-[2px] mb-3.5">
            IMPORTANT DISCLAIMER
          </h4>
          <p className="font-sans text-[12px] text-text-dim leading-relaxed">
            Outpick LLC is a Wyoming limited liability company and is
            not a registered investment adviser, broker-dealer, or financial
            institution. All content is provided for informational and
            educational purposes only and does not constitute investment advice,
            a recommendation, or an offer to buy or sell any securities. The
            authors hold positions in securities discussed in this publication
            and may buy or sell at any time. Past performance is not indicative
            of future results. All investments carry risk, including the
            potential loss of principal. You are solely responsible for your own
            investment decisions. The information presented reflects the
            portfolio and opinions of the authors and should not be relied upon
            as the sole basis for any investment decision. Always conduct your
            own research and consult with a qualified financial adviser before
            investing. By using this service, you acknowledge and agree to our{" "}
            <a href="/terms" className="text-accent-green hover:underline">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="/privacy" className="text-accent-green hover:underline">
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
