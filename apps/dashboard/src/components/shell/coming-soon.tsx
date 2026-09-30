import { type LucideIcon, Clock } from "lucide-react";
import { getTranslations } from "next-intl/server";

// Same pattern as logic-app/lib/core/widgets/coming_soon_screen.dart:
// a centered icon badge + title + muted subtitle.
export async function ComingSoon({
  title,
  icon: Icon = Clock,
  locale,
}: {
  title: string;
  icon?: LucideIcon;
  locale: string;
}) {
  const t = await getTranslations({ locale, namespace: "common" });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{title}</h1>
      <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card py-16">
        <div className="flex size-14 items-center justify-center rounded-full bg-muted">
          <Icon className="size-6 text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="text-base font-semibold">{t("comingSoonTitle")}</p>
          <p className="mt-1.5 text-sm text-muted-foreground">{t("comingSoonBody")}</p>
        </div>
      </div>
    </div>
  );
}
