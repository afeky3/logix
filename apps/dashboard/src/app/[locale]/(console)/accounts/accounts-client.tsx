"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";

export interface AccountOrg {
  id: string;
  name: string;
  kind: string;
  role: string;
}

export interface AccountRow {
  id: string;
  phone: string;
  email: string | null;
  fullName: string | null;
  status: "ACTIVE" | "SUSPENDED";
  lastLoginAt: string | null;
  createdAt: string;
  organizations: AccountOrg[];
}

const FILTERS = ["", "ACTIVE", "SUSPENDED"] as const;

export function AccountsClient() {
  const t = useTranslations("accounts");
  const { accessToken } = useAuth();
  const [rows, setRows] = React.useState<AccountRow[] | null>(null);
  const [total, setTotal] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string>("");
  const [query, setQuery] = React.useState("");
  const [debounced, setDebounced] = React.useState("");

  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  const load = React.useCallback(async () => {
    if (!accessToken) return;
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (status) params.set("status", status);
      if (debounced) params.set("q", debounced);
      const res = await fetch(`/api/admin/accounts?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Failed to load");
      setRows(data.items as AccountRow[]);
      setTotal(data.total as number);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [accessToken, status, debounced]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="max-w-xs"
        />
        {FILTERS.map((s) => (
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
        {rows !== null && <span className="text-sm text-muted-foreground">{t("count", { count: total })}</span>}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {rows === null && !error && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
      {rows !== null && rows.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}

      {rows !== null && rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-start">
              <tr>
                <th className="px-3 py-2 text-start font-medium">{t("columns.name")}</th>
                <th className="px-3 py-2 text-start font-medium">{t("columns.phone")}</th>
                <th className="px-3 py-2 text-start font-medium">{t("columns.email")}</th>
                <th className="px-3 py-2 text-start font-medium">{t("columns.organization")}</th>
                <th className="px-3 py-2 text-start font-medium">{t("columns.status")}</th>
                <th className="px-3 py-2 text-start font-medium">{t("columns.lastLogin")}</th>
                <th className="px-3 py-2 text-start font-medium">{t("columns.created")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t hover:bg-accent/40">
                  <td className="px-3 py-2">
                    <Link href={`/accounts/${r.id}`} className="font-medium hover:underline">
                      {r.fullName || t("noName")}
                    </Link>
                  </td>
                  <td className="bidi-isolate px-3 py-2 font-mono text-xs">{r.phone}</td>
                  <td className="px-3 py-2">{r.email ?? "—"}</td>
                  <td className="px-3 py-2">
                    {r.organizations.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {r.organizations.map((o) => (
                          <Link key={o.id} href={`/organizations/${o.id}`} className="hover:underline text-xs font-medium leading-tight">
                            {o.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">{t(`status.${r.status}`)}</td>
                  <td className="px-3 py-2">{r.lastLoginAt ? new Date(r.lastLoginAt).toLocaleString() : t("never")}</td>
                  <td className="px-3 py-2">{new Date(r.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
