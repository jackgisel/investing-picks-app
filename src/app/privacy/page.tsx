import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <div className="container-op py-20 max-w-[720px]">
      <p className="section-label">LEGAL</p>
      <h1 className="font-sans text-[32px] font-bold mb-3 tracking-tight">
        Privacy Policy
      </h1>
      <p className="font-sans text-[13px] text-text-dim mb-12">
        Last updated: April 2026
      </p>

      <div className="space-y-10 font-sans text-[14px] text-text-muted leading-relaxed">
        <section>
          <h2 className="font-sans text-lg font-semibold text-text mb-3">
            1. Introduction
          </h2>
          <p>
            Outpick LLC, a Wyoming limited liability company
            (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; or
            &quot;our&quot;), operates the website outpick.com. This
            Privacy Policy explains how we collect, use, disclose, and protect
            your personal information when you use our Service.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-lg font-semibold text-text mb-3">
            2. Information We Collect
          </h2>
          <p className="mb-3">
            <strong className="text-text">Account information:</strong> When you
            create an account, we collect your email address and name. We do not
            store payment card details — all payment processing is handled by
            Paddle, our merchant of record.
          </p>
          <p className="mb-3">
            <strong className="text-text">Usage data:</strong> We may collect
            information about how you interact with the Service, including pages
            visited, features used, and time spent on the platform. This data
            is collected via privacy-respecting analytics and does not include
            personally identifiable information.
          </p>
          <p>
            <strong className="text-text">Cookies:</strong> We use essential
            cookies to maintain your session and preferences. We may use
            analytics cookies with your consent. See Section 6 for details.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-lg font-semibold text-text mb-3">
            3. How We Use Your Information
          </h2>
          <p>
            We use your information to provide and maintain the Service, process
            your subscription, send you alerts and notifications related to
            portfolio updates, communicate important account or service updates,
            and improve the Service based on aggregate usage patterns. We do not
            sell, rent, or trade your personal information to third parties for
            marketing purposes.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-lg font-semibold text-text mb-3">
            4. Third-Party Services
          </h2>
          <p className="mb-3">
            We use the following third-party services that may process your
            data:
          </p>
          <p className="mb-2">
            <strong className="text-text">Paddle</strong> — Payment processing
            and merchant of record. Paddle processes your payment information
            and handles tax compliance. See{" "}
            <a
              href="https://www.paddle.com/legal/privacy"
              className="text-accent-green hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Paddle&apos;s Privacy Policy
            </a>
            .
          </p>
          <p className="mb-2">
            <strong className="text-text">Convex</strong> — Backend
            infrastructure. Your account data is stored securely on
            Convex&apos;s servers.
          </p>
          <p>
            <strong className="text-text">Email provider</strong> — We use a
            transactional email service to deliver alerts and notifications. Your
            email address is shared with this provider solely for the purpose of
            delivering communications you have opted into.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-lg font-semibold text-text mb-3">
            5. Data Retention
          </h2>
          <p>
            We retain your account information for as long as your account is
            active or as needed to provide the Service. If you cancel your
            subscription and request account deletion, we will delete your
            personal information within 30 days, except where retention is
            required by law (such as transaction records for tax purposes).
          </p>
        </section>

        <section>
          <h2 className="font-sans text-lg font-semibold text-text mb-3">
            6. Cookies
          </h2>
          <p className="mb-3">
            <strong className="text-text">Essential cookies:</strong> Required
            for the Service to function. These maintain your authentication
            session and security. They cannot be disabled.
          </p>
          <p>
            <strong className="text-text">Analytics cookies:</strong> Used to
            understand how visitors interact with the Service. These are only
            set with your explicit consent via the cookie banner. You may
            withdraw consent at any time by clearing your browser cookies.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-lg font-semibold text-text mb-3">
            7. Your Rights
          </h2>
          <p>
            Depending on your jurisdiction, you may have the right to access
            the personal information we hold about you, request correction of
            inaccurate information, request deletion of your data, object to or
            restrict processing of your data, and request data portability. To
            exercise any of these rights, contact us at
            hello@outpick.com.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-lg font-semibold text-text mb-3">
            8. Data Security
          </h2>
          <p>
            We implement reasonable technical and organizational measures to
            protect your personal information. However, no method of electronic
            storage or transmission is 100% secure, and we cannot guarantee
            absolute security.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-lg font-semibold text-text mb-3">
            9. Children&apos;s Privacy
          </h2>
          <p>
            The Service is not directed to individuals under the age of 18. We
            do not knowingly collect personal information from children. If we
            become aware that a child has provided us with personal information,
            we will take steps to delete it.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-lg font-semibold text-text mb-3">
            10. Changes to This Policy
          </h2>
          <p>
            We may update this Privacy Policy from time to time. Material
            changes will be communicated via email or through the Service. Your
            continued use of the Service after changes constitutes acceptance.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-lg font-semibold text-text mb-3">
            11. Contact
          </h2>
          <p>
            For privacy-related questions or requests, contact us at{" "}
            <a
              href="mailto:hello@outpick.com"
              className="text-accent-green hover:underline"
            >
              hello@outpick.com
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
