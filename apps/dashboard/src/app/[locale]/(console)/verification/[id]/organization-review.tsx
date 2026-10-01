"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { OrgDetail, ItemStatus, KybStatus } from "../data";

const ITEM_STATUS_VARIANT: Record<ItemStatus, "neutral" | "success" | "warning" | "danger"> = {
  PENDING: "neutral",
  ACCEPTED: "success",
  CHANGES_REQUESTED: "warning",
  REJECTED: "danger",
};

const CASE_STATUS_VARIANT: Record<KybStatus, "neutral" | "info" | "warning" | "success" | "danger"> = {
  DRAFT: "neutral",
  SUBMITTED: "neutral",
  UNDER_REVIEW: "info",
  CHANGES_REQUESTED: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

export function OrganizationReview({ organizationId }: { organizationId: string }) {
  const t = useTranslations("kyb.detail");
  const tKyb = useTranslations("kyb");
  const { accessToken } = useAuth();
  const [org, setOrg] = React.useState<OrgDetail | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busyItem, setBusyItem] = React.useState<string | null>(null);
  const [reasonByItem, setReasonByItem] = React.useState<Record<string, string>>({});
  const [caseReason, setCaseReason] = React.useState("");
  const [decidingCase, setDecidingCase] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!accessToken) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/organizations/${organizationId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? t("loadError"));
      setOrg(data as OrgDetail);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("loadError"));
    }
  }, [accessToken, organizationId, t]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const activeCase = org?.verificationCases.find(
    (c) => c.status === "SUBMITTED" || c.status === "UNDER_REVIEW",
  );

  const decideItem = React.useCallback(
    async (caseId: string, itemId: string, status: ItemStatus) => {
      if (!accessToken) return;
      setBusyItem(itemId);
      try {
        await fetch(`/api/admin/verification-cases/${caseId}/items/${itemId}/decision`, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ status, reasonNote: reasonByItem[itemId] || undefined }),
        });
        await load();
      } finally {
        setBusyItem(null);
      }
    },
    [accessToken, reasonByItem, load],
  );

  const decideCase = React.useCallback(
    async (decision: "APPROVED" | "CHANGES_REQUESTED" | "REJECTED") => {
      if (!accessToken || !activeCase) return;
      setDecidingCase(true);
      try {
        await fetch(`/api/admin/verification-cases/${activeCase.id}/decision`, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ decision, reason: caseReason || undefined }),
        });
        await load();
      } finally {
        setDecidingCase(false);
      }
    },
    [accessToken, activeCase, caseReason, load],
  );

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/verification" className="text-sm text-primary hover:underline">
          ← {t("back")}
        </Link>
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!org) {
    return <p className="text-sm text-muted-foreground">{tKyb("loading")}</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/verification" className="text-sm text-primary hover:underline">
          ← {t("back")}
        </Link>
        <h1 className="mt-2 text-xl font-semibold">{org.displayName}</h1>
        <div className="mt-1 flex flex-wrap gap-2">
          {org.workspaces.map((w) => (
            <Badge key={w.workspace} variant={w.status === "ACTIVE" ? "success" : "neutral"}>
              {w.workspace}: {w.status}
            </Badge>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("businessProfile")}</CardTitle>
        </CardHeader>
        <CardContent>
          {org.businessProfile ? (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">{t("legalName")}</dt>
                <dd>{org.businessProfile.legalName}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("tradeName")}</dt>
                <dd>{org.businessProfile.tradeName ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("crNumber")}</dt>
                <dd className="bidi-isolate">{org.businessProfile.crNumber}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("crExpiry")}</dt>
                <dd>{org.businessProfile.crExpiry ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("vatNumber")}</dt>
                <dd className="bidi-isolate">{org.businessProfile.vatNumber ?? "—"}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">—</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("addresses")}</CardTitle>
        </CardHeader>
        <CardContent>
          {org.addresses.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noAddresses")}</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {org.addresses.map((a) => (
                <li key={a.id}>
                  {[a.district, a.street, a.buildingNumber].filter(Boolean).join(", ")}
                  {a.isRegistered && (
                    <Badge variant="outline" className="ms-2">
                      {t("crNumber")}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("licenses")}</CardTitle>
        </CardHeader>
        <CardContent>
          {org.licenses.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noLicenses")}</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {org.licenses.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-4">
                  <span className="bidi-isolate">
                    {l.licenseType} — {l.number}
                  </span>
                  <Badge variant={l.status === "VALID" ? "success" : "neutral"}>{l.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("bankAccounts")}</CardTitle>
        </CardHeader>
        <CardContent>
          {org.bankAccounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noBankAccounts")}</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {org.bankAccounts.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-4">
                  <span>
                    {b.bankName} — ****{b.ibanLast4} ({b.accountHolderName})
                  </span>
                  <Badge variant={b.status === "VERIFIED" ? "success" : "neutral"}>{b.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("files")}</CardTitle>
        </CardHeader>
        <CardContent>
          {org.files.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noFiles")}</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {org.files.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-4">
                  <span>
                    {f.originalName ?? f.id} · {f.purpose}
                  </span>
                  <a
                    href={`/api/admin/files/${f.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    {t("download")}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {activeCase && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t("items")}</CardTitle>
            <Badge variant={CASE_STATUS_VARIANT[activeCase.status]}>
              {tKyb(`status.${activeCase.status}`)}
            </Badge>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {activeCase.items.map((item) => (
              <div key={item.id} className="flex flex-col gap-2 border-b pb-3 last:border-b-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{t(`itemType.${item.type}`)}</span>
                  <Badge variant={ITEM_STATUS_VARIANT[item.status]}>
                    {t(`itemStatus.${item.status}`)}
                  </Badge>
                </div>
                <Input
                  placeholder={t("reasonPlaceholder")}
                  value={reasonByItem[item.id] ?? ""}
                  onChange={(e) =>
                    setReasonByItem((prev) => ({ ...prev, [item.id]: e.target.value }))
                  }
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={busyItem === item.id}
                    onClick={() => void decideItem(activeCase.id, item.id, "ACCEPTED")}
                  >
                    {t("accept")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyItem === item.id}
                    onClick={() => void decideItem(activeCase.id, item.id, "CHANGES_REQUESTED")}
                  >
                    {t("requestChanges")}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={busyItem === item.id}
                    onClick={() => void decideItem(activeCase.id, item.id, "REJECTED")}
                  >
                    {t("reject")}
                  </Button>
                </div>
              </div>
            ))}

            <div className="mt-4 flex flex-col gap-2 border-t pt-4">
              <h3 className="text-sm font-semibold">{t("finalDecision")}</h3>
              <Input
                placeholder={t("decisionReason")}
                value={caseReason}
                onChange={(e) => setCaseReason(e.target.value)}
              />
              <div className="flex gap-2">
                <Button disabled={decidingCase} onClick={() => void decideCase("APPROVED")}>
                  {t("approve")}
                </Button>
                <Button
                  variant="outline"
                  disabled={decidingCase}
                  onClick={() => void decideCase("CHANGES_REQUESTED")}
                >
                  {t("requestChanges")}
                </Button>
                <Button
                  variant="destructive"
                  disabled={decidingCase}
                  onClick={() => void decideCase("REJECTED")}
                >
                  {t("reject")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
