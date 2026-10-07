"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

interface CaseDetail {
  id: string;
  reference: string;
  caseType: string;
  status: string;
  priority: string;
  description: string | null;
  evidenceFileIds: string[];
  subjectType: string;
  subjectReference: string | null;
  openedByOrgName: string | null;
  counterpartyOrgName: string | null;
  resolutionCode: string | null;
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
}

const RESOLUTION_CODES = [
  "RESOLVED_REFUND",
  "RESOLVED_ADJUSTMENT",
  "RESOLVED_REPLACEMENT",
  "RESOLVED_NO_FAULT",
  "RESOLVED_INSURANCE",
  "DUPLICATE",
  "INVALID",
  "WITHDRAWN",
] as const;

export function CaseDetailClient({ id }: { id: string }) {
  const t = useTranslations("cases");
  const { accessToken } = useAuth();
  const [data, setData] = React.useState<CaseDetail | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [resolutionCode, setResolutionCode] = React.useState<string>(RESOLUTION_CODES[0]);
  const [resolutionNote, setResolutionNote] = React.useState("");

  const load = React.useCallback(async () => {
    if (!accessToken) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/cases/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Failed to load");
      setData(json as CaseDetail);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [accessToken, id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function decide(status: "IN_PROGRESS" | "WAITING_ON_CUSTOMER" | "RESOLVED" | "CLOSED") {
    if (!accessToken) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/cases/${id}/decision`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
        body: JSON.stringify(
          status === "RESOLVED" ? { status, resolutionCode, resolutionNote } : { status },
        ),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Failed to update");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  if (error && !data) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">{t("loading")}</p>;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/cases" className="text-sm text-muted-foreground hover:underline">
        ← {t("backToList")}
      </Link>

      <div className="rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="bidi-isolate font-mono text-lg font-semibold">{data.reference}</h1>
          <span className="text-sm text-muted-foreground">{t(`status.${data.status}`)}</span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {data.openedByOrgName ?? "—"}
          {data.subjectReference ? ` · ${data.subjectReference}` : ""}
        </p>
        <p className="mt-3 text-sm">{data.description ?? t("noDescription")}</p>
        {data.evidenceFileIds.length > 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            {t("evidenceCount", { count: data.evidenceFileIds.length })}
          </p>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {data.status !== "RESOLVED" && data.status !== "CLOSED" && (
        <div className="flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={saving} onClick={() => decide("IN_PROGRESS")}>
              {t("markInProgress")}
            </Button>
            <Button size="sm" variant="outline" disabled={saving} onClick={() => decide("WAITING_ON_CUSTOMER")}>
              {t("markWaitingOnCustomer")}
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">{t("resolutionCode")}</label>
            <select
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={resolutionCode}
              onChange={(e) => setResolutionCode(e.target.value)}
            >
              {RESOLUTION_CODES.map((c) => (
                <option key={c} value={c}>
                  {t(`resolutionCodes.${c}`)}
                </option>
              ))}
            </select>
            <textarea
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder={t("resolutionNotePlaceholder")}
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              rows={2}
            />
            <Button disabled={saving} onClick={() => decide("RESOLVED")}>
              {t("resolve")}
            </Button>
          </div>
        </div>
      )}

      {(data.resolutionCode || data.resolutionNote) && (
        <div className="rounded-lg border p-4 text-sm">
          <p className="font-medium">{t("resolutionTitle")}</p>
          <p className="mt-1">{data.resolutionCode ? t(`resolutionCodes.${data.resolutionCode}`) : "—"}</p>
          {data.resolutionNote && <p className="mt-1 text-muted-foreground">{data.resolutionNote}</p>}
        </div>
      )}
    </div>
  );
}
