"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface ProductRow {
  id: string;
  name: string;
  status: string;
  condition: string;
  unitPriceHalalas: number;
  moq: number;
  stockQty: number;
  leadTimeDays: number;
  supplierOrgId: string;
  supplierName: string;
  categorySlug: string;
  categoryNameAr: string;
  categoryNameEn: string;
  createdAt: string;
}

const STATUS_VARIANT: Record<string, "success" | "warning" | "neutral" | "info"> = {
  PUBLISHED: "success",
  PENDING_REVIEW: "warning",
  DRAFT: "neutral",
  PAUSED: "neutral",
  OUT_OF_STOCK: "info",
};

const STATUSES = ["", "PUBLISHED", "PENDING_REVIEW", "DRAFT", "PAUSED", "OUT_OF_STOCK"] as const;

function formatPrice(halalas: number) {
  return (halalas / 100).toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function MarketplaceClient() {
  const t = useTranslations("marketplace");
  const { accessToken } = useAuth();
  const [rows, setRows] = React.useState<ProductRow[] | null>(null);
  const [total, setTotal] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [debounced, setDebounced] = React.useState("");

  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  React.useEffect(() => {
    if (!accessToken) return;
    setError(null);
    void (async () => {
      try {
        const params = new URLSearchParams({ limit: "100" });
        if (statusFilter) params.set("status", statusFilter);
        if (debounced) params.set("q", debounced);
        const res = await fetch(`/api/admin/marketplace?${params}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error?.message ?? "Failed to load");
        setRows(data.items as ProductRow[]);
        setTotal(data.total as number);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      }
    })();
  }, [accessToken, statusFilter, debounced]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="max-w-xs"
        />
        {STATUSES.map((s) => (
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
        {rows !== null && (
          <span className="text-sm text-muted-foreground">{t("count", { count: total })}</span>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {rows === null && !error && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
      {rows !== null && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      )}

      {rows !== null && rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-start font-medium">{t("columns.name")}</th>
                <th className="px-3 py-2 text-start font-medium">{t("columns.supplier")}</th>
                <th className="px-3 py-2 text-start font-medium">{t("columns.category")}</th>
                <th className="px-3 py-2 text-start font-medium">{t("columns.price")}</th>
                <th className="px-3 py-2 text-start font-medium">{t("columns.stock")}</th>
                <th className="px-3 py-2 text-start font-medium">{t("columns.moq")}</th>
                <th className="px-3 py-2 text-start font-medium">{t("columns.status")}</th>
                <th className="px-3 py-2 text-start font-medium">{t("columns.created")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t hover:bg-accent/40">
                  <td className="px-3 py-2 font-medium max-w-[180px] truncate">{r.name}</td>
                  <td className="px-3 py-2">
                    <Link href={`/organizations/${r.supplierOrgId}`} className="hover:underline text-xs">
                      {r.supplierName}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{r.categoryNameAr}</td>
                  <td className="bidi-isolate px-3 py-2 font-mono text-xs">
                    {formatPrice(r.unitPriceHalalas)} {t("currency")}
                  </td>
                  <td className="px-3 py-2 text-center">{r.stockQty}</td>
                  <td className="px-3 py-2 text-center">{r.moq}</td>
                  <td className="px-3 py-2">
                    <Badge variant={STATUS_VARIANT[r.status] ?? "neutral"}>
                      {t(`status.${r.status}`)}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground bidi-isolate">
                    {new Date(r.createdAt).toLocaleDateString("ar-SA")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
