import { getTranslations } from "next-intl/server";
import { Wallet } from "lucide-react";
import { ComingSoon } from "@/components/shell/coming-soon";

export default async function FinancePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return <ComingSoon title={t("finance")} icon={Wallet} locale={locale} />;
}
