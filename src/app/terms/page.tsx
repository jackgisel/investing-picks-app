import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
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
            By accessing or using Outpick website at
            outpick.com (&quot;Service&quot;), you agree to be bound by
            these Terms of Service (&quot;Terms&quot;). If you do not agree to
            these Terms, do not use the Service. The Service is owned and
            operated by Outpick LLC, a Wyoming limited liability
            company (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; or
            &quot;our&quot;).
          </p>
        </section>

        <section>
          <h2 className="font-sans text-lg font-semibold text-text mb-3">
            2. Description of Service
          </h2>
          <p>
            Outpick is an educational and informational publication
            that provides stock market research, portfolio tracking, and
            investment analysis. The Service includes access to a curated
            portfolio of stock picks, performance data, research notes, and
            email alerts delivered on a subscription basis. The Service is
            published by Outpick LLC and reflects the portfolio
            decisions and opinions of its authors.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-lg font-semibold text-text mb-3">
            3. Not Investment Advice
          </h2>
          <p className="mb-3">
            <strong className="text-text">
              The Service does not constitute investment advice, financial
              advice, trading advice, or any other form of professional advice.
            </strong>
          </p>
          <p className="mb-3">
            Outpick LLC is not registered as an investment adviser,
            broker-dealer, financial planner, or fiduciary with the U.S.
            Securities and Exchange Commission (SEC), the Wyoming Secretary of
            State, any state securities regulatory authority, or any other
            regulatory body. The content provided through the Service reflects
            our own opinions and portfolio decisions and should not be construed
            as recommendations to buy, sell, or hold any security.
          </p>
          <p className="mb-3">
            The Service operates as a bona fide financial publication under the
            publisher&apos;s exclusion of the Investment Advisers Act of 1940.
            Content is impersonal in nature, available to all subscribers on the
            same terms, and published on a regular schedule. No content is
            tailored to any individual subscriber&apos;s financial situation,
            risk tolerance, or investment objectives.
          </p>
          <p className="mb-3">
            All investment decisions carry risk, including the potential loss of
            your entire investment. Past performance of our portfolio or any
            individual stock pick is not indicative of future results. You are
            solely responsible for your own investment decisions and should
            consult with a qualified, licensed financial adviser before making
            any investment.
          </p>
          <p>
            By using this Service, you acknowledge that you understand these
            risks and accept full responsibility for your own financial
            decisions.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-lg font-semibold text-text mb-3">
            4. Conflicts of Interest Disclosure
          </h2>
          <p className="mb-3">
            The authors and operators of Outpick LLC hold positions
            in securities discussed through the Service. We may buy, sell, or
            hold any security mentioned in our publications at any time, before
            or after publication.
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
            5. Subscription and Payment
          </h2>
          <p className="mb-3">
            Access to the Service requires a paid annual subscription. Payment
            is processed through Paddle.com Market Limited (&quot;Paddle&quot;),
            our merchant of record. Paddle handles all billing, sales tax, VAT,
            invoicing, and payment processing on our behalf. Your contractual
            relationship for payment purposes is with Paddle, and their terms
            of service apply to all transactions.
          </p>
          <p className="mb-3">
            By subscribing, you authorize recurring annual charges to your
            chosen payment method. The subscription fee is $1,000 USD per year,
            billed annually.
          </p>
          <p>
            You may cancel your subscription at any time through your account
            settings or by contacting Paddle directly. Cancellation takes effect
            at the end of your current billing period. We do not offer prorated
            refunds for partial subscription periods.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-lg font-semibold text-text mb-3">
            6. Refund Policy
          </h2>
          <p>
            Due to the nature of the Service (immediate access to proprietary
            research and portfolio data), all sales are final. We do not offer
            refunds except where required by applicable law or at our sole
            discretion in exceptional circumstances. Refund requests may be
            directed to Paddle as our merchant of record, or to us at
            hello@outpick.com.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-lg font-semibold text-text mb-3">
            7. Account Responsibilities
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
            8. Intellectual Property
          </h2>
          <p>
            All content provided through the Service — including but not limited
            to research notes, analysis, portfolio data, and website design — is
            the intellectual property of Outpick LLC and is protected
            by copyright and other intellectual property laws. You may not
            reproduce, distribute, modify, or publicly display any content from
            the Service without our prior written consent.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-lg font-semibold text-text mb-3">
            9. Disclaimer of Warranties
          </h2>
          <p>
            The Service is provided &quot;as is&quot; and &quot;as
            available&quot; without warranties of any kind, either express or
            implied, including but not limited to implied warranties of
            merchantability, fitness for a particular purpose, and
            non-infringement. We do not warrant that the Service will be
            uninterrupted, error-free, or free of harmful components. We make no
            representations or warranties regarding the accuracy, reliability,
            timeliness, or completeness of any content provided through the
            Service, including any stock picks, analysis, or performance data.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-lg font-semibold text-text mb-3">
            10. Limitation of Liability
          </h2>
          <p className="mb-3">
            To the maximum extent permitted by applicable law, The Long
            Investment LLC, its members, managers, operators, affiliates, and
            contributors shall not be liable for any direct, indirect,
            incidental, special, consequential, or punitive damages — including
            but not limited to loss of profits, loss of data, loss of
            investment, or financial losses of any kind — arising out of or
            related to your use of or reliance on the Service.
          </p>
          <p>
            Our total aggregate liability to you for all claims arising out of
            or related to the Service shall not exceed the amount you paid to us
            in the twelve (12) months immediately preceding the event giving
            rise to the claim. This limitation applies regardless of the form of
            action, whether in contract, tort, strict liability, or otherwise.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-lg font-semibold text-text mb-3">
            11. Assumption of Risk
          </h2>
          <p>
            You expressly acknowledge and agree that investing in securities
            involves substantial risk and that you may lose some or all of your
            invested capital. You agree that Outpick LLC is not
            responsible for any investment losses you may incur, regardless of
            whether those losses are related to content published through the
            Service. You assume all risk associated with any investment
            decisions you make.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-lg font-semibold text-text mb-3">
            12. Indemnification
          </h2>
          <p>
            You agree to indemnify, defend, and hold harmless The Long
            Investment LLC, its members, managers, and operators from and
            against any and all claims, damages, losses, liabilities, costs, and
            expenses (including reasonable attorneys&apos; fees) arising from
            your use of the Service, your violation of these Terms, or your
            investment decisions.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-lg font-semibold text-text mb-3">
            13. Modifications
          </h2>
          <p>
            We reserve the right to modify these Terms at any time. Material
            changes will be communicated via email or through the Service at
            least fourteen (14) days before they take effect. Your continued use
            of the Service after the effective date of modifications constitutes
            acceptance of the updated Terms. If you do not agree to the updated
            Terms, you must cancel your subscription before the effective date.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-lg font-semibold text-text mb-3">
            14. Governing Law and Dispute Resolution
          </h2>
          <p className="mb-3">
            These Terms are governed by and construed in accordance with the
            laws of the State of Wyoming, without regard to its conflict of law
            provisions.
          </p>
          <p className="mb-3">
            Any dispute, controversy, or claim arising out of or relating to
            these Terms or the Service shall be resolved by binding arbitration
            administered by the American Arbitration Association (&quot;AAA&quot;)
            in accordance with its Commercial Arbitration Rules. The
            arbitration shall be conducted by a single arbitrator, and the seat
            of arbitration shall be Cheyenne, Wyoming. The arbitrator&apos;s
            decision shall be final and binding and may be entered as a judgment
            in any court of competent jurisdiction.
          </p>
          <p>
            You agree that any dispute resolution proceedings will be conducted
            on an individual basis and not as a class action, class arbitration,
            or other representative proceeding. You waive any right to
            participate in a class action lawsuit or class arbitration against
            Outpick LLC.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-lg font-semibold text-text mb-3">
            15. Severability
          </h2>
          <p>
            If any provision of these Terms is found to be unenforceable or
            invalid by a court of competent jurisdiction, that provision shall
            be limited or eliminated to the minimum extent necessary, and the
            remaining provisions shall remain in full force and effect.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-lg font-semibold text-text mb-3">
            16. Entire Agreement
          </h2>
          <p>
            These Terms, together with our Privacy Policy, constitute the entire
            agreement between you and Outpick LLC with respect to
            the Service and supersede all prior or contemporaneous
            communications, whether electronic, oral, or written.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-lg font-semibold text-text mb-3">
            17. Contact
          </h2>
          <p>
            For questions regarding these Terms, please contact us at{" "}
            <a
              href="mailto:hello@outpick.com"
              className="text-accent-green hover:underline"
            >
              hello@outpick.com
            </a>
            .
          </p>
          <p className="mt-3">
            Outpick LLC
            <br />
            A Wyoming limited liability company
          </p>
        </section>
      </div>
    </div>
  );
}
