"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import type { PaywallVariant, VariantStatus } from "./types";

export type { PaywallVariant };

const STATUS_VARIANT: Record<VariantStatus, "default" | "secondary" | "outline"> = {
  active: "default",
  draft: "secondary",
  archived: "outline",
};

export function VariantsView({ initial }: { initial: PaywallVariant[] }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link href="/paywall/variants/new" className={buttonVariants()}>
          <Plus className="h-4 w-4" />
          New variant
        </Link>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Headline</TableHead>
              <TableHead>Price set</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {initial.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No variants yet.
                </TableCell>
              </TableRow>
            ) : (
              initial.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-mono text-xs">{v.key}</TableCell>
                  <TableCell className="font-medium">{v.name}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[v.status] ?? "outline"}>{v.status}</Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                    {v.content?.headline || "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {v.priceSetKey ? (
                      <span className="font-mono text-xs">{v.priceSetKey}</span>
                    ) : (
                      <span className="text-muted-foreground">default PPP</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">v{v.version}</TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDateTime(v.updatedAt)}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/paywall/variants/${v.key}`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      Edit
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
