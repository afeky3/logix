import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });

  // TODO(S1+): replace with GET /admin/dashboard/kpis once the backend has it.
  const kpis = [
    { label: "KYB in queue", value: "—" },
    { label: "Open requests", value: "—" },
    { label: "Orders in progress", value: "—" },
    { label: "Cases breaching SLA", value: "—" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {k.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{k.value}</CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
