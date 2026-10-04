"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OrderDetail } from "../data";

function sar(halalas: number): string {
  return `${(halalas / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })} SAR`;
}

export function OrderDetailClient({ orderId }: { orderId: string }) {
  const t = useTranslations("orders.detail");
  const tOrd = useTranslations("orders");
  const { accessToken } = useAuth();
  const [data, setData] = React.useState<OrderDetail | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!accessToken) return;
    (async () => {
      try {
        const res = await fetch(`/api/admin/orders/${orderId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error?.message ?? t("loadError"));
        setData(json as OrderDetail);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("loadError"));
      }
    })();
  }, [accessToken, orderId, t]);

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/orders" className="text-sm text-primary hover:underline">
          ← {t("back")}
        </Link>
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!data) {
    return <p className="text-sm text-muted-foreground">{tOrd("loading")}</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/orders" className="text-sm text-primary hover:underline">
          ← {t("back")}
        </Link>
        <h1 className="mt-2 text-xl font-semibold">{data.reference}</h1>
        <p className="text-sm text-muted-foreground">
          {data.customerName} → {data.providerName} · {data.originSummary ?? "—"} ←{" "}
          {data.destinationSummary ?? "—"}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("fromRequest")}: {data.requestReference}
        </p>
        <Badge variant="info" className="mt-2">
          {tOrd(`status.${data.status}`)}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("amounts")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2 text-sm">
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("total")}</span>
              <span>{sar(data.totalAmountHalalas)}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("vat")}</span>
              <span>{sar(data.vatAmountHalalas)}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("commission")}</span>
              <span>{sar(data.commissionAmountHalalas)}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("netToProvider")}</span>
              <span>{sar(data.netToProviderHalalas)}</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("paymentIntents")}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.paymentIntents.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noPaymentIntents")}</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {data.paymentIntents.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-4">
                  <span className="bidi-isolate">
                    {sar(p.amountHalalas)} · {new Date(p.createdAt).toLocaleString()}
                    {p.failureCode ? ` · ${p.failureCode}` : ""}
                  </span>
                  <Badge
                    variant={
                      p.status === "PAID" ? "success" : p.status === "FAILED" || p.status === "EXPIRED" ? "danger" : "neutral"
                    }
                  >
                    {p.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
