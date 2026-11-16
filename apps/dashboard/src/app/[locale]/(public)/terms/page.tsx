import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { locales } from "@/i18n/locales";
import { TERMS_VERSION, terms } from "./content";

// Public page (no sign-in): the platform terms the app asks people to accept, at logix-co.com/{ar|en}/terms.

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locales, locale)) return {};
  const c = terms[locale];
  return { title: `${c.title} | Logix`, description: c.intro };
}

export default async function TermsPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(locales, locale)) notFound();
  setRequestLocale(locale);
  const c = terms[locale];
  const other = locale === "ar" ? "en" : "ar";

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <span className="text-lg font-bold">Logix</span>
          <Link href="/terms" locale={other} className="text-sm text-muted-foreground hover:text-foreground">
            {c.otherLanguage}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-bold">{c.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {c.versionLabel}: <span dir="ltr">{TERMS_VERSION}</span>
        </p>
        <p className="mt-6 leading-8">{c.intro}</p>

        {c.sections.map((s, i) => (
          <section key={s.title} className="mt-10">
            <h2 className="text-xl font-semibold">
              {i + 1}. {s.title}
            </h2>
            <p className="mt-3 leading-8">{s.body}</p>
          </section>
        ))}

        <p className="mt-10">
          <Link href="/privacy" className="font-medium text-primary underline">
            {c.privacyLabel}
          </Link>
        </p>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-3xl px-4 py-6 text-sm text-muted-foreground">© Logix</div>
      </footer>
    </div>
  );
}
