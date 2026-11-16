import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { locales } from "@/i18n/locales";
import { CONTACT_EMAIL } from "../privacy/content";
import { content } from "./content";
import { DeleteAccountForm } from "./delete-account-form";

// Public page (no sign-in): Google Play links to it as the app's account-deletion page,
// at logix-co.com/{ar|en}/delete-account.

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locales, locale)) return {};
  const c = content[locale];
  return { title: `${c.title} | Logix`, description: c.intro };
}

export default async function DeleteAccountPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(locales, locale)) notFound();
  setRequestLocale(locale);
  const c = content[locale];
  const other = locale === "ar" ? "en" : "ar";

  const list = (title: string, items: string[]) => (
    <section className="mt-8">
      <h2 className="text-xl font-semibold">{title}</h2>
      <ul className="mt-3 list-disc space-y-2 ps-6 leading-8">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </section>
  );

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <span className="text-lg font-bold">Logix</span>
          <Link href="/delete-account" locale={other} className="text-sm text-muted-foreground hover:text-foreground">
            {c.otherLanguage}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-bold">{c.title}</h1>
        <p className="mt-6 leading-8">{c.intro}</p>
        {list(c.whatTitle, c.what)}
        {list(c.keptTitle, c.kept)}
        {list(c.blockedTitle, c.blocked)}

        <section className="mt-10 rounded-lg border border-border bg-card p-5">
          <h2 className="text-xl font-semibold">{c.formTitle}</h2>
          <DeleteAccountForm locale={locale} c={c} />
        </section>

        <p className="mt-8 text-sm text-muted-foreground">
          {c.contact}{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-primary underline" dir="ltr">
            {CONTACT_EMAIL}
          </a>
        </p>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-3xl px-4 py-6 text-sm text-muted-foreground">© Logix</div>
      </footer>
    </div>
  );
}
