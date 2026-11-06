"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";

type Context = "REGISTRATION" | "APP_LAUNCH" | "ORDER";

interface Acceptance {
  id: string;
  acceptedAt: string;
  context: Context;
  items: string[];
  termsVersion: string;
  locale: string;
  user: { id: string; name: string | null; phone: string | null };
  organization: { id: string; name: string } | null;
  quote: { id: string; requestReference: string | null } | null;
  product: { id: string; name: string } | null;
  supplier: { id: string; name: string } | null;
  returnPolicyVersion: string | null;
  identityNumber: string | null;
  identityType: "CR" | "NATIONAL_ID" | null;
  ip: string | null;
  userAgent: string | null;
  appVersion: string | null;
}

interface AcceptanceDetail extends Acceptance {
  returnPolicy: {
    version: string;
    text: string;
    returnWindowDays: number | null;
    allowsReturn: boolean;
    allowsExchange: boolean;
    updatedAt: string;
  } | null;
}

interface Page {
  items: Acceptance[];
  total: number;
  page: number;
  pageSize: number;
}

const CONTEXTS: (Context | "")[] = ["", "REGISTRATION", "APP_LAUNCH", "ORDER"];
const CONTEXT_BADGE: Record<Context, "info" | "neutral" | "warning"> = {
  REGISTRATION: "info",
  APP_LAUNCH: "neutral",
  ORDER: "warning",
};
const PAGE_SIZE = 20;
const PRINT_LIMIT = 500;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ID_FILTERS = ["userId", "organizationId", "quoteId", "productId"] as const;
type IdFilter = (typeof ID_FILTERS)[number];

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function LegalClient() {
  const t = useTranslations("legal");
  const locale = useLocale();
  const { accessToken } = useAuth();

  const [context, setContext] = React.useState<Context | "">("");
  const [search, setSearch] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [ids, setIds] = React.useState<Record<IdFilter, string>>({ userId: "", organizationId: "", quoteId: "", productId: "" });
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [page, setPage] = React.useState(1);

  const [data, setData] = React.useState<Page | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<"csv" | "pdf" | null>(null);
  const [detail, setDetail] = React.useState<AcceptanceDetail | null>(null);

  React.useEffect(() => {
    const id = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(id);
  }, [search]);

  /** Filters as query parameters; ID boxes count only once they hold a whole UUID. */
  const filterParams = React.useCallback(() => {
    const p = new URLSearchParams();
    if (context) p.set("context", context);
    if (query) p.set("q", query);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    for (const k of ID_FILTERS) if (UUID.test(ids[k].trim())) p.set(k, ids[k].trim());
    return p;
  }, [context, query, from, to, ids]);

  const load = React.useCallback(async () => {
    if (!accessToken) return;
    try {
      const params = filterParams();
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      const res = await fetch(`/api/admin/legal-acceptances?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const body = await res.json();
      if (res.status === 403) throw new Error(t("forbidden"));
      if (!res.ok) throw new Error(body?.error?.message ?? t("loadFailed"));
      setData(body as Page);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("loadFailed"));
    }
  }, [accessToken, filterParams, page, t]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (!detail) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDetail(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detail]);

  async function openDetail(id: string) {
    const res = await fetch(`/api/admin/legal-acceptances/${id}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (res.ok) setDetail((await res.json()) as AcceptanceDetail);
  }

  async function exportCsv() {
    setBusy("csv");
    try {
      const res = await fetch(`/api/admin/legal-acceptances/export?${filterParams().toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(t("exportFailed"));
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `legal-acceptances-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("exportFailed"));
    } finally {
      setBusy(null);
    }
  }

  // One unambiguous form for a legal record, the same in both languages and in exports.
  const fmt = (iso: string) => `${new Date(iso).toISOString().slice(0, 19).replace("T", " ")} UTC`;
  const identity = (a: Acceptance) => (a.identityNumber ? `${t(`identity.${a.identityType ?? "CR"}`)}: ${a.identityNumber}` : t("none"));

  /** A self-contained page the browser prints or saves as PDF. */
  function printHtml(title: string, body: string) {
    const w = window.open("", "_blank");
    if (!w) return;
    const dir = locale === "ar" ? "rtl" : "ltr";
    w.document.write(`<!doctype html><html lang="${locale}" dir="${dir}"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>body{font-family:system-ui,"Segoe UI",Tahoma,sans-serif;font-size:11px;color:#111;margin:24px}
h1{font-size:16px;margin:0 0 4px}p.meta{color:#555;margin:0 0 12px}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:4px 6px;text-align:start;vertical-align:top}
th{background:#f1f1f1}td.ltr{direction:ltr;unicode-bidi:isolate}dl{display:grid;grid-template-columns:auto 1fr;gap:4px 12px}
dt{color:#555}dd{margin:0}pre{white-space:pre-wrap;font-family:inherit;margin:0}@page{margin:14mm}</style></head>
<body><h1>${esc(t("printTitle"))}</h1><p class="meta">${esc(t("printedAt", { at: new Date().toISOString() }))} · ${esc(t("printNote"))}</p>${body}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
  }

  async function exportPdf() {
    setBusy("pdf");
    try {
      const params = filterParams();
      // The list endpoint caps pages at 100: collect up to PRINT_LIMIT rows.
      const rows: Acceptance[] = [];
      for (let p = 1; rows.length < PRINT_LIMIT; p++) {
        params.set("page", String(p));
        params.set("pageSize", "100");
        const res = await fetch(`/api/admin/legal-acceptances?${params.toString()}`, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!res.ok) throw new Error(t("exportFailed"));
        const pg = (await res.json()) as Page;
        rows.push(...pg.items);
        if (pg.items.length < 100) break;
      }
      const head = ["acceptedAt", "user", "organization", "context", "subject", "termsVersion", "identity"]
        .map((c) => `<th>${esc(t(`columns.${c}`))}</th>`)
        .join("") + `<th>${esc(t("fields.items"))}</th><th>IP</th>`;
      const body = rows
        .map((a) => `<tr><td class="ltr">${esc(fmt(a.acceptedAt))}</td><td>${esc(a.user.name ?? "")} <span class="ltr">${esc(a.user.phone ?? "")}</span></td>
<td>${esc(a.organization?.name ?? t("none"))}</td><td>${esc(t(`context.${a.context}`))}</td>
<td>${esc(a.quote ? a.quote.requestReference ?? a.quote.id : a.product ? `${a.product.name} (${a.supplier?.name ?? ""}) v${a.returnPolicyVersion ?? "-"}` : t("none"))}</td>
<td class="ltr">${esc(a.termsVersion)}</td><td>${esc(identity(a))}</td><td>${a.items.map((i) => esc(t(`item.${i}`))).join("<br>")}</td><td class="ltr">${esc(a.ip ?? "")}</td></tr>`)
        .join("");
      const note = data && data.total > rows.length ? `<p class="meta">${esc(t("printLimit", { n: rows.length }))}</p>` : "";
      printHtml(t("printTitle"), `${note}<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("exportFailed"));
    } finally {
      setBusy(null);
    }
  }

  function detailRows(a: AcceptanceDetail): [string, React.ReactNode, string][] {
    const none = t("none");
    return [
      ["id", a.id, a.id],
      ["acceptedAt", fmt(a.acceptedAt), fmt(a.acceptedAt)],
      ["user", a.user.name ?? none, a.user.name ?? none],
      ["phone", a.user.phone ?? none, a.user.phone ?? none],
      ["organization", a.organization ? <Link href={`/organizations/${a.organization.id}`} className="text-primary hover:underline">{a.organization.name}</Link> : none, a.organization?.name ?? none],
      ["identity", identity(a), identity(a)],
      ["context", t(`context.${a.context}`), t(`context.${a.context}`)],
      ["termsVersion", a.termsVersion, a.termsVersion],
      ["locale", a.locale, a.locale],
      ["items", <ul key="i" className="list-disc ps-4">{a.items.map((i) => <li key={i}>{t(`item.${i}`)} <span className="font-mono text-xs text-muted-foreground">{i}</span></li>)}</ul>, a.items.map((i) => `${t(`item.${i}`)} (${i})`).join("\n")],
      ["quote", a.quote ? a.quote.requestReference ?? a.quote.id : none, a.quote ? a.quote.requestReference ?? a.quote.id : none],
      ["product", a.product?.name ?? none, a.product?.name ?? none],
      ["supplier", a.supplier?.name ?? none, a.supplier?.name ?? none],
      ["returnPolicyVersion", a.returnPolicyVersion ?? none, a.returnPolicyVersion ?? none],
      ...(a.returnPolicy ? [["returnPolicyText", <p key="p" className="whitespace-pre-wrap">{a.returnPolicy.text}</p>, a.returnPolicy.text] as [string, React.ReactNode, string]] : []),
      ["ip", a.ip ?? none, a.ip ?? none],
      ["userAgent", a.userAgent ?? none, a.userAgent ?? none],
      ["appVersion", a.appVersion ?? none, a.appVersion ?? none],
    ];
  }

  function printRecord(a: AcceptanceDetail) {
    const dl = detailRows(a)
      .map(([k, , text]) => `<dt>${esc(t(`fields.${k}`))}</dt><dd><pre>${esc(text)}</pre></dd>`)
      .join("");
    printHtml(`${t("printTitle")} ${a.id}`, `<dl>${dl}</dl>`);
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const hasFilters = context || search || from || to || ID_FILTERS.some((k) => ids[k]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {CONTEXTS.map((c) => (
          <button
            key={c || "all"}
            onClick={() => {
              setContext(c);
              setPage(1);
            }}
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
              context === c ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:bg-accent"
            }`}
          >
            {c ? t(`context.${c}`) : t("allContexts")}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full max-w-xs">
          <label className="mb-1 block text-xs text-muted-foreground" htmlFor="legal-search">{t("search")}</label>
          <Input id="legal-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchPlaceholder")} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground" htmlFor="legal-from">{t("from")}</label>
          <Input id="legal-from" type="date" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground" htmlFor="legal-to">{t("to")}</label>
          <Input id="legal-to" type="date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        {ID_FILTERS.map((k) => (
          <div key={k} className="w-72">
            <label className="mb-1 block text-xs text-muted-foreground" htmlFor={`legal-${k}`}>{t(k)}</label>
            <Input
              id={`legal-${k}`}
              dir="ltr"
              className="font-mono text-xs"
              value={ids[k]}
              placeholder={t("idPlaceholder")}
              aria-invalid={ids[k].trim() !== "" && !UUID.test(ids[k].trim())}
              onChange={(e) => {
                setIds((prev) => ({ ...prev, [k]: e.target.value }));
                setPage(1);
              }}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" disabled={busy !== null} onClick={exportCsv}>
          {busy === "csv" ? t("exporting") : t("exportCsv")}
        </Button>
        <Button size="sm" variant="outline" disabled={busy !== null} onClick={exportPdf}>
          {busy === "pdf" ? t("exporting") : t("exportPdf")}
        </Button>
        {hasFilters && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setContext("");
              setSearch("");
              setFrom("");
              setTo("");
              setIds({ userId: "", organizationId: "", quoteId: "", productId: "" });
              setPage(1);
            }}
          >
            {t("clear")}
          </Button>
        )}
        {data && <span className="text-sm text-muted-foreground">{t("total", { n: data.total })}</span>}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {data === null && !error && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
      {data !== null && data.items.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}

      {data !== null && data.items.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {(["acceptedAt", "user", "organization", "context", "subject", "termsVersion", "identity"] as const).map((c) => (
                  <th key={c} className="px-3 py-2 text-start font-medium">{t(`columns.${c}`)}</th>
                ))}
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((a) => (
                <tr key={a.id} className="border-t align-top">
                  <td dir="ltr" className="whitespace-nowrap px-3 py-2 text-end font-mono text-xs">{fmt(a.acceptedAt)}</td>
                  <td className="px-3 py-2">
                    <div>{a.user.name ?? t("none")}</div>
                    <div className="bidi-isolate text-xs text-muted-foreground">{a.user.phone}</div>
                  </td>
                  <td className="px-3 py-2">{a.organization?.name ?? t("none")}</td>
                  <td className="px-3 py-2"><Badge variant={CONTEXT_BADGE[a.context]}>{t(`context.${a.context}`)}</Badge></td>
                  <td className="px-3 py-2">
                    {a.quote && <span className="bidi-isolate font-mono text-xs">{a.quote.requestReference ?? a.quote.id}</span>}
                    {a.product && (
                      <div>
                        <div>{a.product.name}</div>
                        <div className="text-xs text-muted-foreground">{a.supplier?.name}{a.returnPolicyVersion ? ` · v${a.returnPolicyVersion}` : ""}</div>
                      </div>
                    )}
                    {!a.quote && !a.product && t("none")}
                  </td>
                  <td className="bidi-isolate px-3 py-2 font-mono text-xs">{a.termsVersion}</td>
                  <td className="bidi-isolate px-3 py-2 text-xs">{identity(a)}</td>
                  <td className="px-3 py-2">
                    <Button size="sm" variant="outline" onClick={() => void openDetail(a.id)}>{t("details")}</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data !== null && data.total > data.pageSize && (
        <div className="flex items-center gap-3 text-sm">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t("previous")}</Button>
          <span className="text-muted-foreground">{t("pageOf", { page, pages: totalPages })}</span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>{t("next")}</Button>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDetail(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="legal-dialog-title"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border bg-card p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="legal-dialog-title" className="text-base font-semibold">{t("details")}</h2>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              {detailRows(detail).map(([k, node]) => (
                <React.Fragment key={k}>
                  <dt className="text-muted-foreground">{t(`fields.${k}`)}</dt>
                  <dd className={["id", "ip", "userAgent", "appVersion", "acceptedAt", "phone", "termsVersion"].includes(k) ? "bidi-isolate break-all font-mono text-xs" : ""}>{node}</dd>
                </React.Fragment>
              ))}
            </dl>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => printRecord(detail)}>{t("printRecord")}</Button>
              <Button onClick={() => setDetail(null)}>{t("close")}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
