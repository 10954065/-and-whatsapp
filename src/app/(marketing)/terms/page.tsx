import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/marketing/legal-page";
import { pageMetadata } from "@/config/seo";

export const metadata: Metadata = pageMetadata("/terms");

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="8 November 2026"
      intro={
        <p>
          These terms govern use of SUNLEON AI, provided by Sunleon Router Enterprise. By creating an account you agree
          to them on behalf of yourself and the business you represent.
        </p>
      }
      sections={[
        {
          heading: "The service",
          body: (
            <p>
              SUNLEON AI provides AI-assisted customer messaging, CRM, order, booking and automation tools. AI output
              can be wrong; you are responsible for the information you provide to the AI and for reviewing its
              actions according to the controls you configure.
            </p>
          ),
        },
        {
          heading: "Your responsibilities",
          body: (
            <p>
              You must have the right to message your customers, obtain any consent required by law, comply with Meta
              WhatsApp Business and Instagram policies, and not use the service for unlawful, deceptive or harmful
              purposes. You must not use the AI to provide medical diagnoses, treatment or legal advice.
            </p>
          ),
        },
        {
          heading: "Accounts and security",
          body: <p>Keep your credentials confidential and enable two-factor authentication for administrators. Tell us promptly about any unauthorised access.</p>,
        },
        {
          heading: "Subscriptions and payment",
          body: (
            <p>
              Paid plans are billed in advance through Paystack. Plan limits apply to AI usage, channels, seats and
              automations. If a payment fails we provide a grace period before restricting paid features. Your data is
              not deleted when a subscription lapses.
            </p>
          ),
        },
        {
          heading: "Third-party services",
          body: (
            <p>
              Messaging relies on Meta platforms and payments on Paystack. Their terms and fees apply, and their
              availability is outside our control. Meta charges for WhatsApp messages separately from your subscription
              and bills your own WhatsApp Business account directly, as explained on our{" "}
              <Link href="/pricing#whatsapp-fees" className="font-medium text-foreground link-underline">
                pricing page
              </Link>
              . We do not collect or set those charges.
            </p>
          ),
        },
        {
          heading: "Data",
          body: <p>You own your business data. Our processing of personal data is described in our Privacy Policy. You can export your data at any time.</p>,
        },
        {
          heading: "Liability",
          body: (
            <p>
              To the extent permitted by law, the service is provided &quot;as is&quot; and our total liability is
              limited to the fees you paid in the twelve months before the claim.
            </p>
          ),
        },
        {
          heading: "Governing law",
          body: <p>These terms are governed by the laws of the Republic of Ghana.</p>,
        },
      ]}
    />
  );
}
