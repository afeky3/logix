import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { OrgDetailClient } from "./org-detail-client";

export default async function OrgDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: "organizations" });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link href="/organizations" className="text-sm text-muted-foreground hover:text-foreground">
          ← {t("backToList")}
        </Link>
      </div>

      <OrgDetailClient orgId={id} />
    </div>
  );
}
