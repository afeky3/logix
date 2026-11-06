"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";

interface PolicyVersion {
  version: string;
  text: string;
  returnWindowDays: number | null;
  allowsReturn: boolean;
  allowsExchange: boolean;
  updatedAt: string;
  isCurrent: boolean;
  createdByName: string | null;
}

interface History {
  currentVersion: string | null;
  items: PolicyVersion[];
}

/** The supplier's return policy in force and every earlier version (newest first). */
export function ReturnPolicySection({ orgId }: { orgId: string }) {
  const t = useTranslations("organizations.returnPolicy");
  const { accessToken } = useAuth();
  const [data, setData] = React.useState<History | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!accessToken) return;
    void (async () => {
      try {
        const res = await fetch(`/api/admin/organizations/${orgId}/return-policy`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error?.message ?? t("loadFailed"));
        setData(body as History);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("loadFailed"));
      }
    })();
  }, [accessToken, orgId, t]);

  const date = (iso: string) => `${new Date(iso).toISOString().slice(0, 16).replace("T", " ")} UTC`;

  const facts = (v: PolicyVersion) => (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      <dt className="text-muted-foreground">{t("allowsReturn")}</dt>
      <dd>{v.allowsReturn ? t("yes") : t("no")}</dd>
      <dt className="text-muted-foreground">{t("allowsExchange")}</dt>
      <dd>{v.allowsExchange ? t("yes") : t("no")}</dd>
      <dt className="text-muted-foreground">{t("window")}</dt>
      <dd>{v.returnWindowDays === null ? t("noWindow") : t("days", { n: v.returnWindowDays })}</dd>
    </dl>
  );

  const current = data?.items.find((v) => v.isCurrent) ?? null;
  const earlier = data?.items.filter((v) => !v.isCurrent) ?? [];

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">{t("title")}</h2>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {data && !current && <p className="text-sm text-muted-foreground">{t("none")}</p>}
      {current && (
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="success">{t("current")}</Badge>
            <span className="font-medium">{t("version", { v: current.version })}</span>
            <span dir="ltr" className="font-mono text-xs text-muted-foreground">{date(current.updatedAt)}</span>
            {current.createdByName && <span className="text-muted-foreground">{t("by", { name: current.createdByName })}</span>}
          </div>
          <p className="whitespace-pre-wrap text-sm">{current.text}</p>
          {facts(current)}
        </div>
      )}
      {earlier.length > 0 && (
        <details className="rounded-lg border p-4">
          <summary className="cursor-pointer text-sm font-medium">
            {t("history")} ({earlier.length})
          </summary>
          <ol className="mt-3 flex flex-col gap-4">
            {earlier.map((v) => (
              <li key={v.version} className="flex flex-col gap-2 border-t pt-3 first:border-t-0 first:pt-0">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant="neutral">{t("version", { v: v.version })}</Badge>
                  <span dir="ltr" className="font-mono text-xs text-muted-foreground">{date(v.updatedAt)}</span>
                  {v.createdByName && <span className="text-muted-foreground">{t("by", { name: v.createdByName })}</span>}
                </div>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{v.text}</p>
                {facts(v)}
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
