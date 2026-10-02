"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { RequestsTable } from "./requests-table";
import type { RequestRow } from "./data";

export function RequestsMonitorClient() {
  const t = useTranslations("requests");
  const { accessToken } = useAuth();
  const [rows, setRows] = React.useState<RequestRow[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<string>("");
  const [zeroQuoteOnly, setZeroQuoteOnly] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!accessToken) return;
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (zeroQuoteOnly) params.set("zeroQuoteOnly", "true");
      const qs = params.toString();
      const res = await fetch(`/api/admin/service-requests${qs ? `?${qs}` : ""}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Failed to load");
      setRows(data as RequestRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [accessToken, statusFilter, zeroQuoteOnly]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const statuses = [
    "",
    "DRAFT",
    "SUBMITTED",
    "QUOTED",
    "AWAITING_PAYMENT",
    "CONVERTED",
    "EXPIRED",
    "CANCELLED",
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {statuses.map((s) => (
          <button
            key={s || "all"}
            onClick={() => setStatusFilter(s)}
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
              statusFilter === s
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background hover:bg-accent"
            }`}
          >
            {s ? t(`status.${s}`) : t("allStatuses")}
          </button>
        ))}
        <button
          onClick={() => setZeroQuoteOnly((v) => !v)}
          className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
            zeroQuoteOnly
              ? "border-destructive bg-destructive text-destructive-foreground"
              : "border-input bg-background hover:bg-accent"
          }`}
        >
          {t("zeroQuoteOnly")}
        </button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {rows === null && !error && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
      {rows !== null && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      )}
      {rows !== null && rows.length > 0 && <RequestsTable rows={rows} />}
    </div>
  );
}
