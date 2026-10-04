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
import { type OrderRow, type OrderStatus } from "./data";

const STATUS_VARIANT: Record<OrderStatus, "neutral" | "info" | "warning" | "success" | "danger"> = {
  PENDING_PAYMENT: "warning",
  VOID: "danger",
  CONFIRMED: "success",
  SCHEDULED: "success",
  IN_PROGRESS: "info",
  ACTIVE: "info",
  CLOSING: "info",
  AWAITING_ACCEPTANCE: "warning",
  DISPUTED: "danger",
  COMPLETED: "success",
  CANCELLATION_REQUESTED: "warning",
  CANCELLED: "danger",
};

function sar(halalas: number): string {
  return `${(halalas / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })} SAR`;
}

export function OrdersTable({ rows }: { rows: OrderRow[] }) {
  const t = useTranslations("orders");

  const columns = React.useMemo<ColumnDef<OrderRow>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: t("columns.createdAt"),
        cell: ({ row }) => (
          <span className="bidi-isolate text-sm">
            {new Date(row.original.createdAt).toLocaleDateString()}
          </span>
        ),
      },
      {
        accessorKey: "reference",
        header: t("columns.reference"),
        cell: ({ row }) => (
          <Link
            href={`/orders/${row.original.id}`}
            className="bidi-isolate font-medium text-primary hover:underline"
          >
            {row.original.reference}
          </Link>
        ),
      },
      { accessorKey: "customerName", header: t("columns.customer") },
      { accessorKey: "providerName", header: t("columns.provider") },
      {
        accessorKey: "totalAmountHalalas",
        header: t("columns.total"),
        cell: ({ row }) => <span className="bidi-isolate">{sar(row.original.totalAmountHalalas)}</span>,
      },
      {
        accessorKey: "paymentStatus",
        header: t("columns.paymentStatus"),
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
