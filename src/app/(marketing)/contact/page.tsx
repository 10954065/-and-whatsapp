import type { Metadata } from "next";
import { Building2, Globe, MapPin } from "lucide-react";
import { ContactForm } from "@/components/marketing/contact-form";
import { PageHero } from "@/components/marketing/marketing-blocks";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <>
      <PageHero eyebrow="Contact" title="Talk to the SUNLEON AI team.">
        Questions about plans, onboarding or a partnership? Send us a message and we&apos;ll reply within one business day.
      </PageHero>
      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-20 lg:grid-cols-[1.3fr_1fr]">
        <div className="rounded-3xl border bg-card p-6 sm:p-8">
          <ContactForm />
        </div>
        <aside className="grid content-start gap-4">
          {[
            { icon: Building2, title: "Company", body: "Sunleon Router Enterprise" },
            { icon: MapPin, title: "Based in", body: "Accra, Ghana" },
            { icon: Globe, title: "Website", body: "sunleonrouterenterprise.com" },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex items-start gap-4 rounded-2xl border bg-card p-5">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm text-muted-foreground">{title}</span>
                <span className="block font-semibold">{body}</span>
              </span>
            </div>
          ))}
        </aside>
      </section>
    </>
  );
}
