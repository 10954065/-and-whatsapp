import type { MetadataRoute } from "next";
import { PUBLIC_PAGES } from "@/config/seo";
import { env } from "@/lib/env";

/** Every public page worth finding in search, from the same list that sets each page's title and description. */
export default function sitemap(): MetadataRoute.Sitemap {
  const site = env().APP_URL;
  return Object.entries(PUBLIC_PAGES)
    .filter(([, page]) => page.inSitemap)
    .map(([path]) => ({ url: path === "/" ? site : `${site}${path}` }));
}
