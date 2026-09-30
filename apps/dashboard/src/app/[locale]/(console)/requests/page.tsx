import { getTranslations } from "next-intl/server";
import { ClipboardList } from "lucide-react";
import { ComingSoon } from "@/components/shell/coming-soon";

export default async function RequestsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return <ComingSoon title={t("requests")} icon={ClipboardList} locale={locale} />;
}
