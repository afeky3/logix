"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { OrgRow } from "./data";

const WORKSPACE_LABELS: Record<string, string> = {
  CUSTOMER: "عميل",
  PROVIDER: "مزوّد",
  SUPPLIER: "مورّد",
};

export function OrgsTable({ rows }: { rows: OrgRow[] }) {
  const t = useTranslations("organizations");

  const columns = React.useMemo<ColumnDef<OrgRow>[]>(
    () => [
      {
        accessorKey: "displayName",
        header: t("columns.name"),
        cell: ({ row }) => (
          <Link
            href={`/organizations/${row.original.id}`}
            className="font-medium text-primary hover:underline"
          >
            {row.original.displayName}
          </Link>
        ),
      },
      {
        accessorKey: "kind",
        header: t("columns.kind"),
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.kind === "BUSINESS" ? t("kindBusiness") : t("kindIndividual")}
          </span>
        ),
      },
      {
        accessorKey: "workspaces",
        header: t("columns.workspaces"),
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.workspaces.length === 0 ? (
              <span className="text-sm text-muted-foreground">—</span>
            ) : (
              row.original.workspaces.map((w) => (
                <Badge key={w.workspace} variant={w.status === "ACTIVE" ? "success" : "neutral"}>
                  {WORKSPACE_LABELS[w.workspace] ?? w.workspace}
                </Badge>
              ))
            )}
          </div>
        ),
      },
      {
        accessorKey: "memberCount",
        header: t("columns.members"),
        cell: ({ row }) => <span className="bidi-isolate text-sm">{row.original.memberCount}</span>,
      },
      {
        accessorKey: "createdAt",
        header: t("columns.createdAt"),
        cell: ({ row }) => (
          <span className="bidi-isolate text-sm">
            {new Date(row.original.createdAt).toLocaleDateString("ar-SA")}
          </span>
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
