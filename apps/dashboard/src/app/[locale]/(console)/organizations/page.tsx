import { getTranslations } from "next-intl/server";
import { Building2 } from "lucide-react";
import { ComingSoon } from "@/components/shell/coming-soon";

export default async function OrganizationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return <ComingSoon title={t("organizations")} icon={Building2} locale={locale} />;
}
