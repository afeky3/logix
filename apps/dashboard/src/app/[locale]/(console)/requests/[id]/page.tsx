import { getTranslations } from "next-intl/server";
import { RequestDetailClient } from "./request-detail-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "requests" });
  return { title: t("title") };
}

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RequestDetailClient requestId={id} />;
}
