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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { type RequestRow, type RequestStatus } from "./data";

const STATUS_VARIANT: Record<RequestStatus, "neutral" | "info" | "warning" | "success" | "danger"> = {
  DRAFT: "neutral",
  SUBMITTED: "info",
  QUOTED: "info",
  AWAITING_PAYMENT: "warning",
  CONVERTED: "success",
  EXPIRED: "danger",
  CANCELLED: "danger",
};

function ageDays(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export function RequestsTable({ rows }: { rows: RequestRow[] }) {
  const t = useTranslations("requests");

  const columns = React.useMemo<ColumnDef<RequestRow>[]>(
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
                days >= 2 ? "text-destructive font-medium" : days >= 1 ? "text-warning" : "",
              )}
            >
              {days === 0 ? "<1d" : `${days}d`}
            </span>
          );
        },
      },
      {
        accessorKey: "reference",
        header: t("columns.reference"),
        cell: ({ row }) => (
          <Link
            href={`/requests/${row.original.id}`}
            className="bidi-isolate font-medium text-primary hover:underline"
          >
            {row.original.reference}
          </Link>
        ),
      },
      {
        accessorKey: "customerName",
        header: t("columns.customer"),
      },
      {
        id: "route",
        header: t("columns.route"),
        cell: ({ row }) => (
          <span className="bidi-isolate">
            {row.original.originSummary ?? "—"} ← {row.original.destinationSummary ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "vehicleTypeCode",
        header: t("columns.vehicle"),
        cell: ({ row }) => row.original.vehicleTypeCode ?? "—",
      },
      {
        accessorKey: "matchedProviderCount",
        header: t("columns.matches"),
      },
      {
        accessorKey: "quoteCount",
        header: t("columns.quotes"),
      },
      {
        accessorKey: "status",
        header: t("columns.status"),
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-1">
            <Badge variant={STATUS_VARIANT[row.original.status]}>
              {t(`status.${row.original.status}`)}
            </Badge>
            {row.original.isZeroQuoteAlert && (
              <Badge variant="danger">{t("zeroQuoteBadge")}</Badge>
            )}
          </div>
        ),
      },
    ],
    [t],
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
