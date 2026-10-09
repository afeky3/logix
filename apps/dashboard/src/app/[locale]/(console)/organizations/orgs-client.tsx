"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { OrgsTable } from "./orgs-table";
import type { OrgRow } from "./data";

export function OrgsClient() {
  const t = useTranslations("organizations");
  const { accessToken } = useAuth();
  const [rows, setRows] = React.useState<OrgRow[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [q, setQ] = React.useState("");
  const [debouncedQ, setDebouncedQ] = React.useState("");

  React.useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q), 400);
    return () => clearTimeout(id);
  }, [q]);

  const load = React.useCallback(async () => {
    if (!accessToken) return;
    setError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedQ) params.set("q", debouncedQ);
      params.set("limit", "100");
      const res = await fetch(`/api/admin/organizations?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Failed to load");
      setRows((data as { items: OrgRow[] }).items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [accessToken, debouncedQ]);

  React.useEffect(() => { void load(); }, [load]);

  return (
    <div className="flex flex-col gap-4">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("searchPlaceholder")}
        className="h-9 w-full max-w-sm rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring"
      />

      {error && <p className="text-sm text-destructive">{error}</p>}
      {rows === null && !error && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
      {rows !== null && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      )}
      {rows !== null && rows.length > 0 && <OrgsTable rows={rows} />}
    </div>
  );
}
