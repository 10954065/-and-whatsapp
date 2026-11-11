import type { MetadataRoute } from "next";
import { env, isProductionDeployment } from "@/lib/env";

/** Crawlers may read the public site; private areas and one-time links are off limits. Preview deployments are never indexed. */
export default function robots(): MetadataRoute.Robots {
  const site = env().APP_URL;
  if (!isProductionDeployment()) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/app/", "/admin/", "/api/", "/onboarding", "/invite/", "/login/mfa", "/verify-email", "/reset-password", "/forgot-password"],
    },
    sitemap: `${site}/sitemap.xml`,
    host: site,
  };
}
