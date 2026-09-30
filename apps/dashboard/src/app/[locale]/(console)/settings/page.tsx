import { getTranslations } from "next-intl/server";
import { Settings } from "lucide-react";
import { ComingSoon } from "@/components/shell/coming-soon";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return <ComingSoon title={t("settings")} icon={Settings} locale={locale} />;
}
