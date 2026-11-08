import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="8 November 2026"
      intro={
        <p>
          This policy explains how Sunleon Router Enterprise (&quot;we&quot;) processes personal data in SUNLEON AI. We
          process personal data in line with Ghana&apos;s Data Protection Act, 2012 (Act 843) and, where they apply,
          other privacy laws such as the EU/UK GDPR.
        </p>
      }
      sections={[
        {
          heading: "Our roles",
          body: (
            <p>
              For account holders (business owners and staff) we are the data controller. For the customer
              conversations, orders and bookings a business manages in SUNLEON AI, the business is the controller and
              we act as its processor, following its instructions.
            </p>
          ),
        },
        {
          heading: "Data we collect",
          body: (
            <p>
              Account data (name, email, password hash, two-factor settings); workspace data (business profile,
              products, services, knowledge documents); customer data a business receives through connected channels
              (names, phone numbers or Instagram identifiers, messages, orders, bookings, consent records); billing
              records; and technical logs (IP address, device information) used for security.
            </p>
          ),
        },
        {
          heading: "How we use data",
          body: (
            <p>
              To provide the service, generate AI replies on a business&apos;s behalf, process payments, secure accounts,
              prevent abuse, and meet legal obligations. We do not sell personal data and we do not use customer
              conversations to train third-party AI models.
            </p>
          ),
        },
        {
          heading: "Sub-processors",
          body: (
            <p>
              We use carefully selected providers: Vercel (hosting), Neon (database), Anthropic (AI processing),
              Meta (WhatsApp and Instagram messaging), Paystack (payments), Resend (email), Cloudflare (file storage)
              and, where enabled, Upstash (job delivery) and Voyage AI (document search embeddings). Some providers
              process data outside Ghana under appropriate safeguards.
            </p>
          ),
        },
        {
          heading: "Retention",
          body: (
            <p>
              Data is kept while an account is active. Businesses can set a message retention period and export or
              delete their data. When a subscription ends we keep workspace data so it can be reactivated, unless
              deletion is requested.
            </p>
          ),
        },
        {
          heading: "Your rights",
          body: (
            <p>
              You may request access to, correction of, or deletion of your personal data, and object to certain
              processing. Customers of a business using SUNLEON AI should contact that business first; we will assist
              it. You may also complain to Ghana&apos;s Data Protection Commission.
            </p>
          ),
        },
        {
          heading: "Security",
          body: (
            <p>
              We use encryption in transit, encryption of integration credentials at rest, strict workspace
              isolation, two-factor authentication, access logging and least-privilege access for our staff.
            </p>
          ),
        },
        {
          heading: "Contact",
          body: <p>Use the contact form on this website to reach our data protection team.</p>,
        },
      ]}
    />
  );
}
