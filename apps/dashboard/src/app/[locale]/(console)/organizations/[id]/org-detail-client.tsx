"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { OrgMember } from "../data";

const ROLE_LABELS: Record<string, string> = {
  OWNER: "المالك",
  MANAGER: "مدير",
  MEMBER: "عضو",
  DRIVER: "سائق",
};

const ROLE_VARIANT: Record<string, "neutral" | "info" | "warning" | "success"> = {
  OWNER: "warning",
  MANAGER: "info",
  MEMBER: "neutral",
  DRIVER: "neutral",
};

export function OrgDetailClient({ orgId }: { orgId: string }) {
  const t = useTranslations("organizations");
  const { accessToken } = useAuth();
  const [members, setMembers] = React.useState<OrgMember[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!accessToken) return;
    void (async () => {
      try {
        const res = await fetch(`/api/admin/organizations/${orgId}/members`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error?.message ?? "Failed to load");
        setMembers(data as OrgMember[]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      }
    })();
  }, [accessToken, orgId]);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-semibold">{t("membersTitle")}</h2>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {members === null && !error && (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      )}
      {members !== null && members.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("noMembers")}</p>
      )}
      {members !== null && members.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("memberColumns.name")}</TableHead>
              <TableHead>{t("memberColumns.phone")}</TableHead>
              <TableHead>{t("memberColumns.role")}</TableHead>
              <TableHead>{t("memberColumns.status")}</TableHead>
              <TableHead>{t("memberColumns.joinedAt")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.id}>
                <TableCell>{m.fullName ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="bidi-isolate">{m.phoneE164}</TableCell>
                <TableCell>
                  <Badge variant={ROLE_VARIANT[m.role] ?? "neutral"}>
                    {ROLE_LABELS[m.role] ?? m.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={m.status === "ACTIVE" ? "success" : "neutral"}>
                    {m.status === "ACTIVE" ? t("statusActive") : m.status}
                  </Badge>
                </TableCell>
                <TableCell className="bidi-isolate text-sm">
                  {new Date(m.joinedAt).toLocaleDateString("ar-SA")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
