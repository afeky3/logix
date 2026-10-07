"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

interface Settlement {
  id: string;
  reference: string;
  beneficiaryName: string;
  beneficiaryRole: string;
  orderId: string | null;
  grossAmount: number;
  commissionAmount: number;
  commissionVatAmount: number;
  netAmount: number;
  status: "SCHEDULED" | "ON_HOLD" | "IN_BATCH" | "PAID" | "FAILED" | "CANCELLED";
  eligibleAt: string;
  payableOn: string;
  paidAt: string | null;
}

interface CompanyBankAccount {
  bankName: string;
  accountHolderName: string;
  iban: string;
  note?: string;
}

const STATUSES = ["", "SCHEDULED", "ON_HOLD", "PAID"] as const;

function sar(halalas: number) {
  return (halalas / 100).toLocaleString(undefined, { minimumFractionDigits: 2 }) + " SAR";
}

export function FinanceClient() {
  const t = useTranslations("finance");
  const { accessToken } = useAuth();
  const [rows, setRows] = React.useState<Settlement[] | null>(null);
  const [bank, setBank] = React.useState<CompanyBankAccount | null>(null);
  const [status, setStatus] = React.useState<string>("");
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!accessToken) return;
    setError(null);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      const res = await fetch(`/api/admin/settlements?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Failed to load");
      setRows(data as Settlement[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [accessToken, status]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (!accessToken) return;
    fetch("/api/admin/settlements/company-bank-account", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((j) => setBank(j && j.iban ? (j as CompanyBankAccount) : null))
      .catch(() => undefined);
  }, [accessToken]);

  async function markPaid(id: string) {
    if (!accessToken) return;
    if (!window.confirm(t("markPaidConfirm"))) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/settlements/${id}/mark-paid`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Failed to update");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {bank && (
        <div className="rounded-lg border border-amber-400/60 bg-amber-50 p-4 text-sm dark:bg-amber-950/30">
          <p className="font-medium">{t("companyAccountTitle")}</p>
          <p className="mt-1">
            {bank.bankName} · {bank.accountHolderName} ·{" "}
            <span className="bidi-isolate font-mono">{bank.iban}</span>
          </p>
          <p className="mt-1 text-amber-700 dark:text-amber-400">{t("placeholderNotice")}</p>
        </div>
      )}

      <p className="text-sm text-muted-foreground">{t("manualPayoutNote")}</p>

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
                <th className="px-3 py-2 text-start font-medium">{t("columns.beneficiary")}</th>
                <th className="px-3 py-2 text-start font-medium">{t("columns.net")}</th>
                <th className="px-3 py-2 text-start font-medium">{t("columns.payableOn")}</th>
                <th className="px-3 py-2 text-start font-medium">{t("columns.status")}</th>
                <th className="px-3 py-2 text-start font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="bidi-isolate px-3 py-2 font-mono text-xs">{s.reference}</td>
                  <td className="px-3 py-2">{s.beneficiaryName}</td>
                  <td className="px-3 py-2">{sar(s.netAmount)}</td>
                  <td className="px-3 py-2">{new Date(s.payableOn).toLocaleDateString()}</td>
                  <td className="px-3 py-2">{t(`status.${s.status}`)}</td>
                  <td className="px-3 py-2">
                    {(s.status === "SCHEDULED" || s.status === "ON_HOLD") && (
                      <Button size="sm" disabled={busyId === s.id} onClick={() => markPaid(s.id)}>
                        {t("markPaid")}
                      </Button>
                    )}
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
