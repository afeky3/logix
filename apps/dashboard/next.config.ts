import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  // TODO: drop basePath once the dashboard has its own subdomain
  // (admin.logix.sa per planning/web_dashboard/md/01-tech-stack.md §2).
  // For now it shares the test server's IP under /console.
  basePath: "/console",
};

export default withNextIntl(nextConfig);
