export const locales = ["ar", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ar";

export const localeDir: Record<Locale, "rtl" | "ltr"> = {
  ar: "rtl",
  en: "ltr",
};
