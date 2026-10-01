"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { type KybRow, type KybStatus } from "./data";

const STATUS_VARIANT: Record<KybStatus, "neutral" | "info" | "warning" | "success" | "danger"> = {
  DRAFT: "neutral",
  SUBMITTED: "neutral",
  UNDER_REVIEW: "info",
  CHANGES_REQUESTED: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

function ageDays(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export function KybTable({ rows, onAssigned }: { rows: KybRow[]; onAssigned?: () => void }) {
  const t = useTranslations("kyb");
  const { accessToken } = useAuth();
  const [assigning, setAssigning] = React.useState<string | null>(null);

  const assignToMe = React.useCallback(
    async (caseId: string) => {
      if (!accessToken) return;
      setAssigning(caseId);
      try {
        const res = await fetch(`/api/admin/verification-cases/${caseId}/assign`, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: "{}",
        });
        if (res.ok) onAssigned?.();
      } finally {
        setAssigning(null);
      }
    },
    [accessToken, onAssigned],
  );

  const columns = React.useMemo<ColumnDef<KybRow>[]>(
    () => [
      {
        accessorKey: "submittedAt",
        header: t("columns.submittedAt"),
        cell: ({ row }) => {
          const days = ageDays(row.original.submittedAt);
          if (days === null) return <span className="text-muted-foreground">—</span>;
          return (
            <span
              className={cn(
                "bidi-isolate text-sm",
                days >= 3 ? "text-destructive font-medium" : days >= 1 ? "text-warning" : "",
              )}
            >
              {days === 0 ? "<1d" : `${days}d`}
            </span>
          );
        },
      },
      {
        accessorKey: "organizationName",
        header: t("columns.organization"),
        cell: ({ row }) => (
          <Link
            href={`/verification/${row.original.organizationId}`}
            className="font-medium text-primary hover:underline"
          >
            {row.original.organizationName}
          </Link>
        ),
      },
      { accessorKey: "workspace", header: t("columns.workspace") },
      {
        accessorKey: "activities",
        header: t("columns.activities"),
        cell: ({ row }) =>
          row.original.activities.length ? (
            <div className="flex flex-wrap gap-1">
              {row.original.activities.map((a) => (
                <Badge key={a} variant="outline">
                  {a}
                </Badge>
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: "crNumber",
        header: t("columns.crNumber"),
        cell: ({ row }) => (
          <span className="bidi-isolate">{row.original.crNumber ?? "—"}</span>
        ),
      },
      {
        accessorKey: "city",
        header: t("columns.city"),
        cell: ({ row }) => row.original.city ?? "—",
      },
      {
        id: "items",
        header: t("columns.items"),
        cell: ({ row }) => (
          <span className="bidi-isolate">
            {row.original.itemsAccepted}/{row.original.itemsTotal}
          </span>
        ),
      },
      { accessorKey: "resubmissionCount", header: t("columns.resubmissions") },
      {
        accessorKey: "assignedTo",
        header: t("columns.assignedTo"),
        cell: ({ row }) =>
          row.original.assignedTo ?? (
            <span className="text-muted-foreground">{t("unassigned")}</span>
          ),
      },
      {
        accessorKey: "status",
        header: t("columns.status"),
        cell: ({ row }) => (
          <Badge variant={STATUS_VARIANT[row.original.status]}>
            {t(`status.${row.original.status}`)}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) =>
          row.original.assignedTo ? null : (
            <Button
              variant="outline"
              size="sm"
              disabled={assigning === row.original.id}
              onClick={() => void assignToMe(row.original.id)}
            >
              {t("assignToMe")}
            </Button>
          ),
      },
    ],
    [t, assigning, assignToMe],
  );

  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((hg) => (
          <TableRow key={hg.id}>
            {hg.headers.map((h) => (
              <TableHead key={h.id}>
                {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow key={row.id}>
            {row.getVisibleCells().map((cell) => (
              <TableCell key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
