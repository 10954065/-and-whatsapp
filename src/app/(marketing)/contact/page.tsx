import type { Metadata } from "next";
import { PaperPlaneDrawing } from "@/components/marketing/contact-drawing";
import { ContactForm } from "@/components/marketing/contact-form";
import { PageHero, PenUnderlined, TONE_WASH } from "@/components/marketing/marketing-blocks";
import { pageMetadata } from "@/config/seo";
import { TONES } from "@/config/tones";
import { cn } from "@/lib/utils";

export const metadata: Metadata = pageMetadata("/contact");

const DETAILS = [
  { title: "Company", body: "Sunleon Router Enterprise" },
  { title: "Based in", body: "Accra, Ghana" },
  { title: "Website", body: "sunleonrouterenterprise.com" },
  { title: "Replies", body: "Within one business day" },
];

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title={
          <>
            Talk to a <PenUnderlined>person</PenUnderlined> <span className="italic">at Sunleon.</span>
          </>
        }
      >
        Questions about plans, setting up or working together? Send us a message and we&apos;ll reply within one business day.
      </PageHero>
      <section className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-20">
        <div className="surface overflow-hidden rounded-[2rem]">
          <div className={cn(TONE_WASH, TONES.sun, "flex items-center gap-5 px-6 py-5 sm:px-10")}>
            <PaperPlaneDrawing className="h-16 w-auto shrink-0 text-foreground sm:h-20" />
            <div>
              <h2 className="font-display text-3xl leading-none font-normal tracking-[-0.01em]">Write to us</h2>
              <p className="mt-1.5 text-sm text-foreground/70">Your message goes straight to our team.</p>
            </div>
          </div>
          <div className="p-6 sm:p-10">
            <ContactForm />
          </div>
        </div>
        <dl className="grid content-start">
          {DETAILS.map((detail) => (
            <div key={detail.title} className="border-b py-5 first:pt-0">
              <dt className="text-sm text-muted-foreground">{detail.title}</dt>
              <dd className="mt-1 font-display text-2xl tracking-[-0.01em]">{detail.body}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
