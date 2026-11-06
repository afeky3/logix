"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";

type VerificationStatus = "AWAITING_VERIFICATION" | "PAID" | "REJECTED" | "EXPIRED";

interface PaymentRow {
  id: string;
  paymentType: "ORDER" | "CONTRACT_CYCLE";
  status: string;
  verificationStatus: string;
  amountHalalas: number;
  currency: string;
  orderId: string;
  orderReference: string;
  cycleNo: number | null;
  customerName: string;
  createdAt: string;
  paidAt: string | null;
  expiresAt: string;
  failureCode: string | null;
  failureMessage: string | null;
}

interface PaymentList {
  items: PaymentRow[];
  page: number;
  pageSize: number;
  total: number;
}

const FILTERS: (VerificationStatus | "")[] = ["AWAITING_VERIFICATION", "PAID", "REJECTED", "EXPIRED", ""];
const PAGE_SIZE = 20;

const BADGE: Record<string, "warning" | "success" | "danger" | "neutral"> = {
  AWAITING_VERIFICATION: "warning",
  PAID: "success",
  REJECTED: "danger",
  EXPIRED: "neutral",
};

function sar(halalas: number) {
  return `${(halalas / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })} SAR`;
}

interface PaymentDetails {
  payerName: string | null;
  payerPhone: string | null;
  canApprove: boolean;
  approveBlockedReason: string | null;
  reviews: { action: string; staffName: string | null; reason: string | null; at: string }[];
}

type Dialog = { kind: "approve" | "reject"; row: PaymentRow } | null;

export function PaymentsClient() {
  const t = useTranslations("payments");
  const { accessToken, staff } = useAuth();
  // The server enforces this too; hiding the buttons just spares read-only staff a 403.
  const canVerify = (staff?.permissions ?? []).some((p) => p === "*" || p === "finance.payments.verify");

  const [status, setStatus] = React.useState<VerificationStatus | "">("AWAITING_VERIFICATION");
  const [search, setSearch] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [page, setPage] = React.useState(1);

  const [data, setData] = React.useState<PaymentList | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const [dialog, setDialog] = React.useState<Dialog>(null);
  const [reason, setReason] = React.useState("");
  const [dialogError, setDialogError] = React.useState<string | null>(null);
  const [details, setDetails] = React.useState<PaymentDetails | null>(null);
  const [busy, setBusy] = React.useState(false);

  // Search runs a moment after typing stops, not on every keystroke.
  React.useEffect(() => {
    const id = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(id);
  }, [search]);

  const load = React.useCallback(async () => {
    if (!accessToken) return;
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (status) params.set("status", status);
      if (query) params.set("q", query);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`/api/admin/payments?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const body = await res.json();
      if (res.status === 403) throw new Error(t("forbidden"));
      if (!res.ok) throw new Error(body?.error?.message ?? t("loadFailed"));
      setData(body as PaymentList);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("loadFailed"));
    }
  }, [accessToken, page, status, query, from, to, t]);

  React.useEffect(() => {
    void load();
  }, [load]);

  function openDialog(kind: "approve" | "reject", row: PaymentRow) {
    setDialog({ kind, row });
    setReason("");
    setDialogError(null);
    setDetails(null);
    // Who sent it and what was decided before: what staff match against the bank statement.
    void fetch(`/api/admin/payments/${row.id}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setDetails(d as PaymentDetails | null))
      .catch(() => undefined);
  }

  React.useEffect(() => {
    if (!dialog || busy) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDialog(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog, busy]);

  async function submit() {
    if (!dialog || !accessToken) return;
    const { kind, row } = dialog;
    if (kind === "reject" && reason.trim().length < 3) {
      setDialogError(t("reasonRequired"));
      return;
    }
    setBusy(true);
    setDialogError(null);
    try {
      const res = await fetch(`/api/admin/payments/${row.id}/${kind}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(kind === "reject" ? { reason: reason.trim() } : {}),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? t("actionFailed"));
      setDialog(null);
      setNotice(t(kind === "approve" ? "approved" : "rejected", { order: row.orderReference }));
      await load();
    } catch (e) {
      setDialogError(e instanceof Error ? e.message : t("actionFailed"));
      // A 409 means someone else already decided it: show the current state behind the dialog.
      await load();
    } finally {
      setBusy(false);
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((s) => (
          <button
            key={s || "all"}
            onClick={() => {
              setStatus(s);
              setPage(1);
            }}
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

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full max-w-xs">
          <label className="mb-1 block text-xs text-muted-foreground" htmlFor="pay-search">
            {t("search")}
          </label>
          <Input
            id="pay-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground" htmlFor="pay-from">
            {t("from")}
          </label>
          <Input
            id="pay-from"
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground" htmlFor="pay-to">
            {t("to")}
          </label>
          <Input
            id="pay-to"
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {notice && (
        <p role="status" className="rounded-md border border-(--success) bg-(--success-bg) px-3 py-2 text-sm text-(--success)">
          {notice}
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {data === null && !error && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
      {data !== null && data.items.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}

      {data !== null && data.items.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-start font-medium">{t("columns.createdAt")}</th>
                <th className="px-3 py-2 text-start font-medium">{t("columns.order")}</th>
                <th className="px-3 py-2 text-start font-medium">{t("columns.customer")}</th>
                <th className="px-3 py-2 text-start font-medium">{t("columns.type")}</th>
                <th className="px-3 py-2 text-start font-medium">{t("columns.amount")}</th>
                <th className="px-3 py-2 text-start font-medium">{t("columns.status")}</th>
                <th className="px-3 py-2 text-start font-medium" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((p) => (
                <tr key={p.id} className="border-t align-top">
                  <td className="bidi-isolate px-3 py-2">{new Date(p.createdAt).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <Link href={`/orders/${p.orderId}`} className="bidi-isolate font-mono text-xs text-primary hover:underline">
                      {p.orderReference}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{p.customerName}</td>
                  <td className="px-3 py-2">
                    {p.paymentType === "CONTRACT_CYCLE" ? t("type.CONTRACT_CYCLE", { n: p.cycleNo ?? 0 }) : t("type.ORDER")}
                  </td>
                  <td className="bidi-isolate px-3 py-2">{sar(p.amountHalalas)}</td>
                  <td className="px-3 py-2">
                    <Badge variant={BADGE[p.verificationStatus] ?? "neutral"}>
                      {t(`status.${p.verificationStatus}`)}
                    </Badge>
                    {p.verificationStatus === "REJECTED" && p.failureMessage && (
                      <p className="mt-1 max-w-56 text-xs text-muted-foreground">{p.failureMessage}</p>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      {canVerify && p.verificationStatus === "AWAITING_VERIFICATION" && (
                        <>
                          <Button size="sm" onClick={() => openDialog("approve", p)}>
                            {t("approve")}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openDialog("reject", p)}>
                            {t("reject")}
                          </Button>
                        </>
                      )}
                      {canVerify && p.verificationStatus === "EXPIRED" && (
                        <Button size="sm" variant="outline" onClick={() => openDialog("approve", p)}>
                          {t("approveLate")}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data !== null && data.total > data.pageSize && (
        <div className="flex items-center gap-3 text-sm">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            {t("previous")}
          </Button>
          <span className="text-muted-foreground">{t("pageOf", { page, pages: totalPages })}</span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            {t("next")}
          </Button>
        </div>
      )}

      {dialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !busy && setDialog(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pay-dialog-title"
            className="w-full max-w-md rounded-lg border bg-card p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="pay-dialog-title" className="text-base font-semibold">
              {t(dialog.kind === "approve" ? "approveTitle" : "rejectTitle")}
            </h2>
            <p className="mt-2 text-sm">
              {t(dialog.kind === "approve" ? "approveBody" : "rejectBody", {
                amount: sar(dialog.row.amountHalalas),
                order: dialog.row.orderReference,
              })}
            </p>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted-foreground">{t("columns.customer")}</dt>
              <dd>{dialog.row.customerName}</dd>
              {details?.payerName && (
                <>
                  <dt className="text-muted-foreground">{t("payer")}</dt>
                  <dd>{details.payerName}</dd>
                </>
              )}
              {details?.payerPhone && (
                <>
                  <dt className="text-muted-foreground">{t("phone")}</dt>
                  <dd className="bidi-isolate">{details.payerPhone}</dd>
                </>
              )}
              <dt className="text-muted-foreground">{t("requestedAt")}</dt>
              <dd className="bidi-isolate">{new Date(dialog.row.createdAt).toLocaleString()}</dd>
              <dt className="text-muted-foreground">{t("holdUntil")}</dt>
              <dd className="bidi-isolate">{new Date(dialog.row.expiresAt).toLocaleString()}</dd>
            </dl>
            {details && details.reviews.length > 0 && (
              <div className="mt-3 text-sm">
                <p className="font-medium">{t("history")}</p>
                <ul className="mt-1 flex flex-col gap-1 text-muted-foreground">
                  {details.reviews.map((r, i) => (
                    <li key={i}>
                      {t(`action.${r.action}`)}
                      {r.staffName ? ` · ${t("by", { name: r.staffName })}` : ""} ·{" "}
                      <span className="bidi-isolate">{new Date(r.at).toLocaleString()}</span>
                      {r.reason ? ` · ${r.reason}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {dialog.kind === "approve" && details && !details.canApprove && (
              <p className="mt-2 text-sm text-destructive">
                {t("blocked", { reason: details.approveBlockedReason ?? "" })}
              </p>
            )}
            {dialog.kind === "approve" && dialog.row.verificationStatus === "EXPIRED" && (
              <p className="mt-2 text-sm text-(--warning)">{t("lateNote")}</p>
            )}
            {dialog.kind === "reject" && (
              <div className="mt-3">
                <label className="mb-1 block text-sm font-medium" htmlFor="pay-reason">
                  {t("reasonLabel")}
                </label>
                <textarea
                  id="pay-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  maxLength={500}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder={t("reasonPlaceholder")}
                />
              </div>
            )}
            {dialogError && <p className="mt-2 text-sm text-destructive">{dialogError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" disabled={busy} onClick={() => setDialog(null)}>
                {t("cancel")}
              </Button>
              <Button
                variant={dialog.kind === "reject" ? "destructive" : "default"}
                disabled={busy || (dialog.kind === "approve" && details !== null && !details.canApprove)}
                onClick={submit}
              >
                {t(dialog.kind === "approve" ? "confirmApprove" : "confirmReject")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
