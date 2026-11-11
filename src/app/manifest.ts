import type { MetadataRoute } from "next";
import { PUBLIC_PAGES, SITE_NAME } from "@/config/seo";

/** Name, colours and icons for "Add to home screen" and installed-app use. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: "Sunleon",
    description: PUBLIC_PAGES["/"].description,
    start_url: "/app/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f8f6f0",
    theme_color: "#f8f6f0",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
