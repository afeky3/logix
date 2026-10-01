import { getTranslations } from "next-intl/server";
import { OrganizationReview } from "./organization-review";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "kyb" });
  return { title: t("title") };
}

export default async function VerificationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OrganizationReview organizationId={id} />;
}
