import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "/terms" },
  title: "Terms of Service",
  description:
    "Terms of Service for Outpick, an independent financial research publication. Not investment advice. Annual membership billed via Stripe.",
};

export default function TermsPage() {
  return (
    <div className="container-op py-20 max-w-[720px]">
      <p className="section-label">LEGAL</p>
      <h1 className="font-sans text-[32px] font-bold mb-3 tracking-tight">
        Terms of Service
      </h1>
      <p className="font-sans text-[13px] text-text-dim mb-12">
        Last updated: April 2026
      </p>

      <div className="space-y-10 font-sans text-[14px] text-text-muted leading-relaxed">
        <section>
          <h2 className="font-sans text-lg font-semibold text-text mb-3">
            1. Agreement to Terms
          </h2>
          <p>
            By accessing or using the Outpick website at outpick.xyz
            (&quot;Service&quot;), you agree to be bound by these Terms of
            Service (&quot;Terms&quot;). If you do not agree to these Terms, do
            not use the Service. The Service is published and operated by Outpick
            (&quot;Publisher,&quot; &quot;we,&quot; &quot;us,&quot; or
            &quot;our&quot;), an independent financial research publication.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-lg font-semibold text-text mb-3">
            2. Description of Service
          </h2>
          <p>
            Outpick is an educational and informational publication that provides
            stock market research, portfolio tracking, and investment analysis.
            The Service includes access to a curated portfolio of stock picks,
            performance data, research notes, and email alerts delivered on a
            subscription basis. Content reflects the portfolio decisions and
            opinions of the Publisher and is provided for your general
            information and education only.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-lg font-semibold text-text mb-3">
            3. Not Investment Advice — No Fiduciary Relationship
          </h2>
          <p className="mb-3">
            <strong className="text-text">
              Nothing on the Service constitutes investment advice, financial
              advice, trading advice, tax advice, legal advice, or any other form
              of professional advice. Nothing on the Service is a recommendation
              or solicitation to buy, sell, or hold any security.
            </strong>
          </p>
          <p className="mb-3">
            The Publisher is not registered as an investment adviser,
            broker-dealer, financial planner, or fiduciary with the U.S.
            Securities and Exchange Commission (SEC), any state securities
            regulatory authority, or any other regulatory body. No advisory
            relationship, fiduciary relationship, or special duty of care is
            created between you and the Publisher by your use of the Service or
            your subscription.
          </p>
          <p className="mb-3">
            The Service operates as a bona fide financial publication under the
            publisher&apos;s exclusion of the Investment Advisers Act of 1940.
            Content is impersonal in nature, available to all subscribers on the
            same terms, and published on a regular schedule. No content is
            tailored to any individual subscriber&apos;s financial situation,
            risk tolerance, tax circumstances, or investment objectives.
          </p>
          <p className="mb-3">
            You are solely responsible for evaluating any information on the
            Service and for all investment decisions you make. You should consult
            with qualified, licensed professionals (including financial, tax, and
            legal advisers) before making any investment or financial decision.
          </p>
          <p>
            By using the Service, you acknowledge that you understand the risks
            of investing — including the possible loss of your entire investment
            — and that you accept full and exclusive responsibility for your own
            financial decisions and outcomes.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-lg font-semibold text-text mb-3">
            4. No Reliance; Your Own Due Diligence
          </h2>
          <p className="mb-3">
            Any research, commentary, portfolio data, or stock picks published
            through the Service describe what the Publisher owns, is considering,
            or has owned — not what you should do. You agree not to treat any
            content as a directive, instruction, or personalized recommendation.
          </p>
          <p>
            You agree to conduct your own independent research and due diligence
            before acting on any information from the Service. Past performance of
            the Publisher&apos;s portfolio or any individual pick is not
            indicative of future results and is no guarantee of your results if
            you choose to invest similarly.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-lg font-semibold text-text mb-3">
            5. Conflicts of Interest Disclosure
          </h2>
          <p className="mb-3">
            The Publisher and its operators hold positions in securities
            discussed through the Service. We may buy, sell, or hold any
            security mentioned in our publications at any time, before or after
            publication, without notice to subscribers.
          </p>
          <p>
            We do not receive compensation from any company whose securities are
            featured in the Service. Our sole source of revenue is subscription
            fees paid by members. We do not accept advertising, sponsored
            content, or affiliate commissions from brokerage firms or financial
            institutions.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-lg font-semibold text-text mb-3">
            6. Subscription and Payment
          </h2>
          <p className="mb-3">
            Access to the Service requires a paid annual subscription. Outpick
            is the seller of the Service. Stripe is our payment processor and
            provides hosted checkout, billing, and invoicing. Stripe Tax
            calculates applicable sales tax, VAT, or similar taxes based on the
            information provided at checkout and our registered jurisdictions.
          </p>
          <p className="mb-3">
            By subscribing, you authorize recurring annual charges to your
            chosen payment method. The standard subscription fee is $1,000 USD
            per year, billed annually, plus applicable taxes. Eligible founders
            accounts pay $250 USD for the first annual period only and $1,000
            USD per year thereafter, plus applicable taxes.
          </p>
          <p>
            You may cancel your subscription at any time through your account
            settings through the Stripe Customer Portal. Cancellation takes effect
            at the end of your current billing period. We do not offer prorated
            refunds for partial subscription periods.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-lg font-semibold text-text mb-3">
            7. Refund Policy
          </h2>
          <p>
            Due to the nature of the Service (immediate access to proprietary
            research and portfolio data), all sales are final. We do not offer
            refunds except where required by applicable law or at our sole
            discretion in exceptional circumstances. Refund requests may be
            directed to us at hello@outpick.xyz.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-lg font-semibold text-text mb-3">
            8. Account Responsibilities
          </h2>
          <p className="mb-3">
            You are responsible for maintaining the confidentiality of your
            account credentials and for all activities that occur under your
            account. You agree to notify us immediately of any unauthorized
            access or use.
          </p>
          <p>
            Each subscription is for a single individual. You may not share your
            login credentials, distribute our content, or resell access to the
            Service. Violation of this provision may result in immediate
            termination of your account without refund.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-lg font-semibold text-text mb-3">
            9. Intellectual Property
          </h2>
          <p>
            All content provided through the Service — including research notes,
            analysis, portfolio data, and website design — is the intellectual
            property of the Publisher and is protected by copyright and other
            intellectual property laws. You may not reproduce, distribute,
            modify, or publicly display any content from the Service without our
            prior written consent.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-lg font-semibold text-text mb-3">
            10. Disclaimer of Warranties
          </h2>
          <p>
            The Service is provided &quot;as is&quot; and &quot;as
            available&quot; without warranties of any kind, whether express or
            implied, including implied warranties of merchantability, fitness for
            a particular purpose, accuracy, and non-infringement. We do not
            warrant that the Service will be uninterrupted, error-free, or free of
            harmful components. We make no representations or warranties
            regarding the accuracy, reliability, timeliness, or completeness of
            any content, including stock picks, analysis, or performance data.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-lg font-semibold text-text mb-3">
            11. Limitation of Liability
          </h2>
          <p className="mb-3">
            <strong className="text-text">
              To the maximum extent permitted by applicable law, the Publisher,
              its operators, and contributors shall not be liable for any direct,
              indirect, incidental, special, consequential, exemplary, or
              punitive damages — including loss of profits, loss of data, loss of
              investment, trading losses, or any other financial losses — arising
              from or related to your use of, reliance on, or inability to use
              the Service, whether or not we have been advised of the possibility
              of such damages.
            </strong>
          </p>
          <p className="mb-3">
            Without limiting the foregoing, the Publisher is not responsible for
            any investment losses you incur, whether or not those losses relate
            to content published through the Service, securities mentioned in
            the Service, or decisions you make based on the Service.
          </p>
          <p>
            Our total aggregate liability to you for all claims arising out of or
            related to the Service shall not exceed the greater of (a) the amount
            you paid to us in the twelve (12) months immediately preceding the
            event giving rise to the claim, or (b) one hundred U.S. dollars
            ($100). This limitation applies regardless of the form of action,
            whether in contract, tort, strict liability, or otherwise.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-lg font-semibold text-text mb-3">
            12. Assumption of Risk
          </h2>
          <p>
            You expressly acknowledge that investing in securities involves
            substantial risk and that you may lose some or all of your invested
            capital. You assume all risk associated with any investment or
            trading decisions you make, including decisions made after reading,
            viewing, or relying on any content from the Service. You agree that
            the Publisher bears no responsibility for your investment outcomes.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-lg font-semibold text-text mb-3">
            13. Indemnification
          </h2>
          <p>
            You agree to indemnify, defend, and hold harmless the Publisher, its
            operators, and contributors from and against any and all claims,
            demands, damages, losses, liabilities, costs, and expenses (including
            reasonable attorneys&apos; fees) arising out of or related to: (a)
            your use of the Service; (b) your violation of these Terms; (c) your
            investment, trading, or financial decisions; or (d) your violation
            of any law or the rights of any third party.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-lg font-semibold text-text mb-3">
            14. Modifications
          </h2>
          <p>
            We reserve the right to modify these Terms at any time. Material
            changes will be communicated via email or through the Service at
            least fourteen (14) days before they take effect. Your continued use
            of the Service after the effective date constitutes acceptance of the
            updated Terms. If you do not agree to the updated Terms, you must
            cancel your subscription before the effective date.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-lg font-semibold text-text mb-3">
            15. Governing Law and Dispute Resolution
          </h2>
          <p className="mb-3">
            These Terms are governed by the laws of the United States and the
            state in which the Publisher is domiciled, without regard to
            conflict-of-law principles.
          </p>
          <p className="mb-3">
            Any dispute arising out of or relating to these Terms or the Service
            shall be resolved by binding arbitration administered by the American
            Arbitration Association (&quot;AAA&quot;) under its Consumer
            Arbitration Rules, except that either party may seek injunctive relief
            in court for intellectual property or unauthorized use of the
            Service. The arbitrator&apos;s decision shall be final and binding.
          </p>
          <p>
            You agree that dispute resolution will be conducted only on an
            individual basis and not as a class action, class arbitration, or
            other representative proceeding. You waive any right to participate
            in a class action lawsuit or class arbitration against the Publisher.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-lg font-semibold text-text mb-3">
            16. Severability
          </h2>
          <p>
            If any provision of these Terms is found unenforceable or invalid, that
            provision shall be limited or eliminated to the minimum extent
            necessary, and the remaining provisions shall remain in full force and
            effect.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-lg font-semibold text-text mb-3">
            17. Entire Agreement
          </h2>
          <p>
            These Terms, together with our Privacy Policy, constitute the entire
            agreement between you and the Publisher with respect to the Service
            and supersede all prior or contemporaneous communications, whether
            electronic, oral, or written.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-lg font-semibold text-text mb-3">
            18. Contact
          </h2>
          <p>
            For questions regarding these Terms, contact us at{" "}
            <a
              href="mailto:hello@outpick.xyz"
              className="text-accent-green hover:underline"
            >
              hello@outpick.xyz
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
