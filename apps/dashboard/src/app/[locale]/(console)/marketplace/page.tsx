import { getTranslations } from "next-intl/server";
import { Store } from "lucide-react";
import { ComingSoon } from "@/components/shell/coming-soon";

export default async function MarketplacePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return <ComingSoon title={t("marketplace")} icon={Store} locale={locale} />;
}
