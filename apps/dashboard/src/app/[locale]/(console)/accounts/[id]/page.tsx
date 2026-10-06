import { getTranslations } from "next-intl/server";
import { AccountDetailClient } from "./account-detail-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "accounts" });
  return { title: t("detailTitle") };
}

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id } = await params;
  return <AccountDetailClient id={id} />;
}
