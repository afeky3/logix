import createMiddleware from "next-intl/middleware";
import { locales, defaultLocale } from "./i18n/locales";

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: "always",
});

export const config = {
  // Skip API routes, static files and Next internals.
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
