import { getTranslations } from "next-intl/server";
import { Gavel } from "lucide-react";
import { ComingSoon } from "@/components/shell/coming-soon";

export default async function CasesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return <ComingSoon title={t("cases")} icon={Gavel} locale={locale} />;
}
