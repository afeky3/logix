"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RequestDetail } from "../data";

function sar(halalas: number): string {
  return `${(halalas / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })} SAR`;
}

export function RequestDetailClient({ requestId }: { requestId: string }) {
  const t = useTranslations("requests.detail");
  const tReq = useTranslations("requests");
  const { accessToken } = useAuth();
  const [data, setData] = React.useState<RequestDetail | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!accessToken) return;
    (async () => {
      try {
        const res = await fetch(`/api/admin/service-requests/${requestId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error?.message ?? t("loadError"));
        setData(json as RequestDetail);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("loadError"));
      }
    })();
  }, [accessToken, requestId, t]);

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/requests" className="text-sm text-primary hover:underline">
          ← {t("back")}
        </Link>
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!data) {
    return <p className="text-sm text-muted-foreground">{tReq("loading")}</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/requests" className="text-sm text-primary hover:underline">
          ← {t("back")}
        </Link>
        <h1 className="mt-2 text-xl font-semibold">{data.reference}</h1>
        <p className="text-sm text-muted-foreground">
          {data.customerName} · {data.originSummary ?? "—"} ← {data.destinationSummary ?? "—"}
        </p>
        <Badge variant="info" className="mt-2">
          {tReq(`status.${data.status}`)}
        </Badge>
      </div>

      {data.storage && (
        <Card>
          <CardHeader>
            <CardTitle>{t("storageTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {Object.entries(data.storage).map(([k, v]) => (
              <p key={k}>
                <span className="text-muted-foreground">{k}: </span>
                {v === null ? "—" : String(v)}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {data.customs && (
        <Card>
          <CardHeader>
            <CardTitle>{t("customsTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p>{data.customs.movement ?? "—"} · {data.customs.billOfLadingNo ?? "—"}</p>
            {data.customs.documents.map((d) => (
              <p key={d.doc_type}>{d.doc_type}: {d.original_name ?? t("noFile")}</p>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("matches")}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.matches.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noMatches")}</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {data.matches.map((m, i) => (
                <li key={i} className="flex items-center justify-between gap-4">
                  <span>{m.providerName}</span>
                  <span className="text-muted-foreground">
                    {m.quotedAt
                      ? t("quoted")
                      : m.declinedAt
                        ? t("declined")
                        : m.viewedAt
                          ? t("viewed")
                          : m.notifiedAt
                            ? t("notified")
                            : t("notYet")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("quotes")}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.quotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noQuotes")}</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {data.quotes.map((q) => (
                <li key={q.id} className="flex items-center justify-between gap-4">
                  <span>
                    {q.providerName} — {sar(q.totalAmountHalalas)}
                  </span>
                  <div className="flex items-center gap-2">
                    {q.isAnomaly && <Badge variant="danger">{t("anomaly")}</Badge>}
                    <Badge variant={q.status === "SUBMITTED" ? "success" : "neutral"}>
                      {q.status}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
