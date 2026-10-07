"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";

interface CaseRow {
  id: string;
  reference: string;
  caseType: string;
  status: string;
  priority: string;
  openedByOrgName: string | null;
  subjectReference: string | null;
  createdAt: string;
}

const STATUSES = ["", "OPEN", "IN_PROGRESS", "WAITING_ON_CUSTOMER", "RESOLVED", "CLOSED"] as const;

export function CasesClient() {
  const t = useTranslations("cases");
  const { accessToken } = useAuth();
  const [rows, setRows] = React.useState<CaseRow[] | null>(null);
  const [status, setStatus] = React.useState<string>("");
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!accessToken) return;
    setError(null);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      const res = await fetch(`/api/admin/cases?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Failed to load");
      setRows(data as CaseRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [accessToken, status]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
          <button
            key={s || "all"}
            onClick={() => setStatus(s)}
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
              status === s
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background hover:bg-accent"
            }`}
          >
            {s ? t(`status.${s}`) : t("allStatuses")}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {rows === null && !error && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
      {rows !== null && rows.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}

      {rows !== null && rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-start font-medium">{t("columns.reference")}</th>
                <th className="px-3 py-2 text-start font-medium">{t("columns.openedBy")}</th>
                <th className="px-3 py-2 text-start font-medium">{t("columns.order")}</th>
                <th className="px-3 py-2 text-start font-medium">{t("columns.status")}</th>
                <th className="px-3 py-2 text-start font-medium">{t("columns.created")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t hover:bg-accent/40">
                  <td className="px-3 py-2">
                    <Link href={`/cases/${c.id}`} className="bidi-isolate font-mono text-xs hover:underline">
                      {c.reference}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{c.openedByOrgName ?? "—"}</td>
                  <td className="bidi-isolate px-3 py-2 font-mono text-xs">{c.subjectReference ?? "—"}</td>
                  <td className="px-3 py-2">{t(`status.${c.status}`)}</td>
                  <td className="px-3 py-2">{new Date(c.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
