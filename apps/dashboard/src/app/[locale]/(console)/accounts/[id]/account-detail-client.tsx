"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

interface AccountDetail {
  id: string;
  phone: string;
  email: string | null;
  fullName: string | null;
  locale: string;
  status: "ACTIVE" | "SUSPENDED" | "DELETED";
  hasPassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  activeSessions: number;
  organizations: {
    id: string;
    name: string;
    kind: string;
    orgStatus: string;
    membershipRole: string;
    membershipStatus: string;
    workspaces: { workspace: string; status: string }[];
    verificationCases: { id: string; workspace: string; status: string; submittedAt: string | null }[];
  }[];
}

export function AccountDetailClient({ id }: { id: string }) {
  const t = useTranslations("accounts");
  const { accessToken } = useAuth();
  const [account, setAccount] = React.useState<AccountDetail | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!accessToken) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/accounts/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Failed to load");
      setAccount(data as AccountDetail);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [accessToken, id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function changeStatus(next: "ACTIVE" | "SUSPENDED") {
    if (!accessToken) return;
    if (next === "SUSPENDED" && !window.confirm(t("suspendConfirm"))) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/accounts/${id}/status`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Failed to update");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  if (error && !account) return <p className="text-sm text-destructive">{error}</p>;
  if (!account) return <p className="text-sm text-muted-foreground">{t("loading")}</p>;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/accounts" className="text-sm text-muted-foreground hover:underline">
        ← {t("backToList")}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">{account.fullName || t("noName")}</h1>
          <p className="bidi-isolate font-mono text-sm">{account.phone}</p>
          <p className="text-sm">{account.email ?? "—"}</p>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>
              {t("columns.status")}: {t(`status.${account.status}`)}
            </span>
            <span>
              {t("hasPassword")}: {account.hasPassword ? t("yes") : t("no")}
            </span>
            <span>
              {t("activeSessions")}: {account.activeSessions}
            </span>
            <span>
              {t("columns.lastLogin")}: {account.lastLoginAt ? new Date(account.lastLoginAt).toLocaleString() : t("never")}
            </span>
          </div>
        </div>
        {account.status === "ACTIVE" && (
          <Button variant="destructive" disabled={saving} onClick={() => changeStatus("SUSPENDED")}>
            {t("suspend")}
          </Button>
        )}
        {account.status === "SUSPENDED" && (
          <Button disabled={saving} onClick={() => changeStatus("ACTIVE")}>
            {t("reactivate")}
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">{t("organizationsTitle")}</h2>
        {account.organizations.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("noOrganizations")}</p>
        )}
        {account.organizations.map((o) => (
          <div key={o.id} className="flex flex-col gap-2 rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{o.name}</span>
              <span className="text-xs text-muted-foreground">
                {o.kind} · {o.membershipRole} · {o.orgStatus}
              </span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">{t("workspacesTitle")}: </span>
              {o.workspaces.length === 0
                ? t("none")
                : o.workspaces.map((w) => `${w.workspace} (${w.status})`).join(" · ")}
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">{t("casesTitle")}: </span>
              {o.verificationCases.length === 0
                ? t("none")
                : o.verificationCases.map((c) => `${c.workspace}: ${c.status}`).join(" · ")}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
