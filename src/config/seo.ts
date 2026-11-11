import type { Metadata } from "next";
import { CONTACT } from "@/config/contact";

export const SITE_NAME = "SUNLEON AI";

/** The shared link preview (WhatsApp, Instagram, X, Google), 1200 x 630. */
export const OG_IMAGE = {
  url: "/og/sunleon-og.png",
  width: 1200,
  height: 630,
  alt: "SUNLEON AI, the front desk that never closes: AI replies on WhatsApp and Instagram for businesses in Ghana",
};

interface PageSeo {
  title: string;
  description: string;
  /** The home page uses its title as is, without the " · SUNLEON AI" suffix. */
  absoluteTitle?: boolean;
  /** Pages worth finding in search; others still get a description and canonical URL. */
  inSitemap: boolean;
}

/** Search title, description and canonical path for every public page. The sitemap is built from this. */
export const PUBLIC_PAGES = {
  "/": {
    title: "SUNLEON AI · WhatsApp & Instagram AI assistant for Ghana",
    absoluteTitle: true,
    description:
      "Answer customers on WhatsApp and Instagram in seconds with your real prices and stock. SUNLEON AI takes orders and bookings and hands tricky chats to you.",
    inSitemap: true,
  },
  "/features": {
    title: "Features: one inbox, AI replies, orders, bookings",
    description:
      "One inbox for WhatsApp and Instagram, AI replies from your real prices and stock, orders with verified payments, bookings, leads, automations and analytics.",
    inSitemap: true,
  },
  "/solutions": {
    title: "Solutions for sales, bookings and customer service",
    description:
      "Answer enquiries, take orders on WhatsApp, fill your booking calendar and follow up leads, with every conversation tied to the customer's records.",
    inSitemap: true,
  },
  "/industries": {
    title: "For shops, salons, restaurants and more",
    description:
      "Ready-made setups for 11 kinds of business in Ghana: restaurants, retail and fashion shops, beauty, salons and spas, hotels, real estate, clinics, schools and more.",
    inSitemap: true,
  },
  "/pricing": {
    title: "Pricing in Ghana cedis",
    description:
      "Simple monthly and yearly SUNLEON AI plans in Ghana cedis, each starting with a free trial. Change plans or stop at any time, and your data is never deleted.",
    inSitemap: true,
  },
  "/about": {
    title: "About Sunleon Router Enterprise",
    description:
      "SUNLEON AI is made by Sunleon Router Enterprise, a Ghanaian technology company helping businesses answer customers faster without losing the personal touch.",
    inSitemap: true,
  },
  "/contact": {
    title: "Contact the Sunleon team",
    description: "Questions about plans, setting up or working together? Message the Sunleon team and we'll reply within one business day.",
    inSitemap: true,
  },
  "/register": {
    title: "Start your free trial",
    description:
      "Create your SUNLEON AI account and set up an assistant for your WhatsApp and Instagram in a few short steps. No card needed.",
    inSitemap: true,
  },
  "/login": {
    title: "Sign in",
    description: "Sign in to your SUNLEON AI workspace.",
    inSitemap: false,
  },
  "/privacy": {
    title: "Privacy Policy",
    description: "How SUNLEON AI collects, uses and protects personal data, in line with Ghana's Data Protection Act, 2012 (Act 843).",
    inSitemap: true,
  },
  "/terms": {
    title: "Terms of Service",
    description:
      "The terms for using SUNLEON AI, including subscriptions and payment, acceptable use, and third-party services such as Meta and Paystack.",
    inSitemap: true,
  },
} satisfies Record<string, PageSeo>;

export type PublicPath = keyof typeof PUBLIC_PAGES;

/** Title, description, canonical URL and link preview for one public page. */
export function pageMetadata(path: PublicPath): Metadata {
  const page: PageSeo = PUBLIC_PAGES[path];
  const fullTitle = page.absoluteTitle ? page.title : `${page.title} · ${SITE_NAME}`;
  return {
    title: page.absoluteTitle ? { absolute: page.title } : page.title,
    description: page.description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "en_GH",
      url: path,
      title: fullTitle,
      description: page.description,
      images: [OG_IMAGE],
    },
    twitter: { card: "summary_large_image", title: fullTitle, description: page.description, images: [OG_IMAGE.url] },
  };
}

/** schema.org data for the home page: who runs the site and how to reach them. */
export function organizationJsonLd(siteUrl: string): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: "Sunleon Router Enterprise",
        alternateName: SITE_NAME,
        url: siteUrl,
        logo: `${siteUrl}/icons/icon-512.png`,
        sameAs: [CONTACT.instagram.url],
        address: { "@type": "PostalAddress", addressLocality: "Accra", addressCountry: "GH" },
        contactPoint: [
          {
            "@type": "ContactPoint",
            contactType: "customer support",
            telephone: CONTACT.whatsapp.e164,
            email: CONTACT.email,
            areaServed: "GH",
            availableLanguage: ["en"],
          },
        ],
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: SITE_NAME,
        inLanguage: "en-GH",
        publisher: { "@id": `${siteUrl}/#organization` },
      },
    ],
  };
}
