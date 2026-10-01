"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { KybTable } from "./kyb-table";
import type { KybRow } from "./data";

export function VerificationQueueClient() {
  const t = useTranslations("kyb");
  const { accessToken } = useAuth();
  const [rows, setRows] = React.useState<KybRow[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<string>("");

  const load = React.useCallback(async () => {
    if (!accessToken) return;
    setError(null);
    try {
      const qs = statusFilter ? `?status=${statusFilter}` : "";
      const res = await fetch(`/api/admin/verification-cases${qs}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Failed to load");
      setRows(data as KybRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [accessToken, statusFilter]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const statuses = ["", "SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED", "APPROVED", "REJECTED"];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
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
            {s ? t(`status.${s}`) : t("filters.allStatuses")}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {rows === null && !error && (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      )}
      {rows !== null && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      )}
      {rows !== null && rows.length > 0 && <KybTable rows={rows} onAssigned={load} />}
    </div>
  );
}
