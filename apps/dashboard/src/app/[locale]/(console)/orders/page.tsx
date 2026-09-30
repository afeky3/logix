import { getTranslations } from "next-intl/server";
import { Truck } from "lucide-react";
import { ComingSoon } from "@/components/shell/coming-soon";

export default async function OrdersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return <ComingSoon title={t("orders")} icon={Truck} locale={locale} />;
}
