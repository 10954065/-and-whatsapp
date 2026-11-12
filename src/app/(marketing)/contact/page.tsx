import type { Metadata } from "next";
import { ArrowUpRight, Camera, type LucideIcon, Mail, MessageCircle } from "lucide-react";
import { PaperPlaneDrawing } from "@/components/marketing/contact-drawing";
import { ContactForm } from "@/components/marketing/contact-form";
import { PageHero, PenUnderlined, TONE_WASH } from "@/components/marketing/marketing-blocks";
import { CONTACT } from "@/config/contact";
import { pageMetadata } from "@/config/seo";
import { TONES } from "@/config/tones";
import { cn } from "@/lib/utils";

export const metadata: Metadata = pageMetadata("/contact");

const CHANNELS: Array<{ label: string; value: string; href: string; icon: LucideIcon; tone: string; isExternal: boolean }> = [
  { label: "WhatsApp", value: CONTACT.whatsapp.display, href: CONTACT.whatsapp.url, icon: MessageCircle, tone: TONES.mint, isExternal: true },
  { label: "Email", value: CONTACT.email, href: `mailto:${CONTACT.email}`, icon: Mail, tone: TONES.sky, isExternal: false },
  { label: "Instagram", value: CONTACT.instagram.handle, href: CONTACT.instagram.url, icon: Camera, tone: TONES.rose, isExternal: true },
];

function ReachUs() {
  return (
    <section aria-labelledby="reach-us" className="surface rounded-[2rem] p-6 sm:p-8">
      <h2 id="reach-us" className="font-display text-3xl leading-none font-normal tracking-[-0.01em]">
        Or reach us directly
      </h2>
      <ul className="mt-5 grid gap-1">
        {CHANNELS.map(({ label, value, href, icon: Icon, tone, isExternal }) => (
          <li key={label}>
            <a
              href={href}
              {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className={cn(
                "group pressable -mx-3 flex items-center gap-4 rounded-2xl px-3 py-3 transition-colors duration-200 hover:bg-[color-mix(in_oklch,var(--tone)_16%,transparent)]",
                tone,
              )}
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-(--tone) text-[#1d1a16] dark:text-foreground">
                <Icon aria-hidden="true" className="size-4.5" strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-muted-foreground">{label}</span>
                <span className="block font-medium wrap-anywhere">{value}</span>
              </span>
              <ArrowUpRight
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out-strong group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </a>
          </li>
        ))}
      </ul>
      <dl className="mt-5 grid gap-x-6 gap-y-4 border-t pt-5 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Company</dt>
          <dd className="mt-0.5 font-medium">Sunleon Router Enterprise</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Based in</dt>
          <dd className="mt-0.5 font-medium">Accra, Ghana</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Website</dt>
          <dd className="mt-0.5 font-medium wrap-anywhere">
            <a href={CONTACT.website.url} target="_blank" rel="noopener noreferrer" className="link-underline">
              {CONTACT.website.display}
            </a>
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Replies</dt>
          <dd className="mt-0.5 font-medium">Within one business day</dd>
        </div>
      </dl>
    </section>
  );
}

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
        <div className="grid content-start gap-5">
          <ReachUs />
        </div>
      </section>
    </>
  );
}
