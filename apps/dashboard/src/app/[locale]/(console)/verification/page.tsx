import { getTranslations } from "next-intl/server";
import { KybTable } from "./kyb-table";
import { mockKybRows } from "./data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "kyb" });
  return { title: t("title") };
}

export default async function VerificationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "kyb" });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      {/* TODO(S2): GET /admin/verification-cases with filters (status, workspace,
          activity, city, assignedToMe/unassigned, date) — see
          planning/web_dashboard/md/modules/02-verification-kyb.md §D10.
          Mock rows below until then. */}
      <KybTable rows={mockKybRows} />
    </div>
  );
}
