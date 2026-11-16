"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";

interface OrgFile {
  id: string;
  purpose: string;
  mimeType: string;
  originalName: string | null;
  scanStatus: string;
  createdAt: string;
}

interface OrgCase {
  id: string;
  workspace: string;
  status: string;
}

interface OrgDetail {
  files: OrgFile[];
  verificationCases: OrgCase[];
}

const utc = (iso: string) => `${new Date(iso).toISOString().slice(0, 16).replace("T", " ")} UTC`;

/** Every document the organization uploaded. The staff token lives in memory, so a plain link would be
 * refused (401): the file is fetched with it, then opened or saved. */
export function DocumentsSection({ orgId }: { orgId: string }) {
  const t = useTranslations("organizations.documents");
  const { accessToken } = useAuth();
  const [data, setData] = React.useState<OrgDetail | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/admin/organizations/${orgId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error?.message ?? t("loadFailed"));
        if (!cancelled) setData(body as OrgDetail);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : t("loadFailed"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, orgId, t]);

  async function fetchFile(f: OrgFile, mode: "view" | "download") {
    if (!accessToken) return;
    setError(null);
    // Opened inside the click, or the browser blocks the popup.
    const tab = mode === "view" ? window.open("", "_blank") : null;
    try {
      const res = await fetch(`/api/admin/files/${f.id}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) throw new Error("failed");
      const url = URL.createObjectURL(await res.blob());
      if (tab) {
        tab.location.href = url;
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = f.originalName ?? f.id;
        a.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      tab?.close();
      setError(t("fileFailed"));
    }
  }

  const openCase = data?.verificationCases.find((c) => ["SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED"].includes(c.status));

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{t("title")}</h2>
        {data && data.verificationCases.length > 0 && (
          <Link href={`/verification/${orgId}`} className="text-sm text-primary hover:underline">
            {openCase ? t("reviewCase") : t("verificationHistory")}
          </Link>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {!data && !error && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
      {data && data.files.length === 0 && <p className="text-sm text-muted-foreground">{t("none")}</p>}
      {data && data.files.length > 0 && (
        <ul className="flex flex-col divide-y rounded-lg border bg-card text-sm">
          {data.files.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{f.originalName ?? f.id}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="neutral">{f.purpose}</Badge>
                  <span dir="ltr" className="font-mono">{f.mimeType}</span>
                  <span dir="ltr" className="font-mono">{utc(f.createdAt)}</span>
                </p>
              </div>
              <span className="flex gap-3">
                <button type="button" className="text-primary hover:underline" onClick={() => void fetchFile(f, "view")}>
                  {t("view")}
                </button>
                <button type="button" className="text-primary hover:underline" onClick={() => void fetchFile(f, "download")}>
                  {t("download")}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
