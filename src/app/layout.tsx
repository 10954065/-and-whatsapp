import type { Metadata, Viewport } from "next";
import { Geist_Mono, Instrument_Serif, Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { OG_IMAGE, PUBLIC_PAGES, SITE_NAME } from "@/config/seo";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], axes: ["opsz"] });
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: {
    default: PUBLIC_PAGES["/"].title,
    template: `%s · ${SITE_NAME}`,
  },
  description: PUBLIC_PAGES["/"].description,
  applicationName: SITE_NAME,
  authors: [{ name: "Sunleon Router Enterprise", url: "https://sunleonrouterenterprise.com" }],
  creator: "Sunleon Router Enterprise",
  publisher: "Sunleon Router Enterprise",
  keywords: [
    "WhatsApp AI assistant",
    "WhatsApp chatbot Ghana",
    "Instagram DM automation",
    "AI customer service Ghana",
    "WhatsApp Business API Ghana",
    "online shop orders on WhatsApp",
    "booking assistant for salons",
    "SUNLEON AI",
  ],
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_GH",
    title: PUBLIC_PAGES["/"].title,
    description: PUBLIC_PAGES["/"].description,
    images: [OG_IMAGE],
  },
  twitter: { card: "summary_large_image", title: PUBLIC_PAGES["/"].title, description: PUBLIC_PAGES["/"].description, images: [OG_IMAGE.url] },
  // Set GOOGLE_SITE_VERIFICATION to verify a URL-prefix property in Search Console with a meta tag.
  verification: process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : undefined,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f6f0" },
    { media: "(prefers-color-scheme: dark)", color: "#161412" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${instrumentSerif.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
          <Toaster position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
