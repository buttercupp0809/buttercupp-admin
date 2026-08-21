"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Coins, TrendingDown, TrendingUp } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

type Reason = "all" | "purchase" | "image_gen" | "voice_gen" | "premium_msg" | "grant";

interface LedgerRow {
  id: string;
  userId: string;
  delta: number;
  reason: string;
  balanceAfter: number;
  refId: string | null;
  createdAt: string;
  user: { email: string };
}

const REASON_LABELS: Record<string, string> = {
  purchase: "Purchase",
  image_gen: "Image Gen",
  voice_gen: "Voice Gen",
  premium_msg: "Premium Msg",
  grant: "Grant",
};

function ReasonBadge({ reason }: { reason: string }) {
  const variants: Record<string, string> = {
    purchase: "bg-blue-100 text-blue-800",
    image_gen: "bg-purple-100 text-purple-800",
    voice_gen: "bg-indigo-100 text-indigo-800",
    premium_msg: "bg-orange-100 text-orange-800",
    grant: "bg-green-100 text-green-800",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${variants[reason] ?? "bg-gray-100 text-gray-800"}`}
    >
      {REASON_LABELS[reason] ?? reason}
    </span>
  );
}

export default function TokensPage() {
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [reason, setReason] = useState<Reason>("all");
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ grantThisMonth: 0, spentThisMonth: 0 });

  const [grantEmail, setGrantEmail] = useState("");
  const [grantAmount, setGrantAmount] = useState("");
  const [grantNote, setGrantNote] = useState("");
  const [granting, setGranting] = useState(false);

  const limit = 50;

  const fetchLedger = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: page.toString(), reason });
    const res = await fetch(`/api/tokens?${params}`);
    const data = await res.json();
    setLedger(data.ledger ?? []);
    setTotal(data.total ?? 0);
    setSummary(data.summary ?? { grantThisMonth: 0, spentThisMonth: 0 });
    setLoading(false);
  }, [page, reason]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  function handleReasonChange(v: string) {
    setReason(v as Reason);
    setPage(1);
  }

  async function handleGrant(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseInt(grantAmount);
    if (!grantEmail || isNaN(amount) || amount <= 0) {
      toast.error("Provide a valid email and positive token amount.");
      return;
    }
    setGranting(true);
    try {
      const res = await fetch("/api/tokens/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: grantEmail, amount, note: grantNote || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Grant failed");
      } else {
        toast.success(`Granted ${amount} tokens. New balance: ${data.newBalance}`);
        setGrantEmail("");
        setGrantAmount("");
        setGrantNote("");
        fetchLedger();
      }
    } finally {
      setGranting(false);
    }
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Coins className="h-6 w-6 text-yellow-500" />
          Tokens
        </h1>
        <p className="text-muted-foreground mt-1">Token ledger and manual grants</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground font-normal">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Grants this month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              +{summary.grantThisMonth.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground font-normal">
              <TrendingDown className="h-4 w-4 text-red-500" />
              Spent this month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">
              -{summary.spentThisMonth.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Ledger browser */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Token Ledger</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Reason:</span>
            <Select value={reason} onValueChange={handleReasonChange}>
              <SelectTrigger className="w-[160px] h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="purchase">Purchase</SelectItem>
                <SelectItem value="image_gen">Image Gen</SelectItem>
                <SelectItem value="voice_gen">Voice Gen</SelectItem>
                <SelectItem value="premium_msg">Premium Msg</SelectItem>
                <SelectItem value="grant">Grant</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User Email</TableHead>
                <TableHead className="w-28 text-right">Delta</TableHead>
                <TableHead className="w-32">Reason</TableHead>
                <TableHead className="w-36 text-right">Balance After</TableHead>
                <TableHead>Ref ID</TableHead>
                <TableHead className="w-40">Created At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : ledger.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No records found
                  </TableCell>
                </TableRow>
              ) : (
                ledger.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-sm">
                      <Link
                        href={`/users/${row.userId}`}
                        className="text-blue-600 hover:underline"
                      >
                        {row.user.email}
                      </Link>
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono font-semibold ${
                        row.delta >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {row.delta >= 0 ? "+" : ""}
                      {row.delta.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <ReasonBadge reason={row.reason} />
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">
                      {row.balanceAfter.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono max-w-[180px] truncate">
                      {row.refId ?? "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(row.createdAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {(page - 1) * limit + 1}-{Math.min(page * limit, total)} of {total}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Issue grant form */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Issue Token Grant</h2>
        <Card size="sm" className="max-w-md">
          <CardContent className="pt-4">
            <form onSubmit={handleGrant} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="grant-email">User Email</Label>
                <Input
                  id="grant-email"
                  type="text"
                  placeholder="user@example.com"
                  value={grantEmail}
                  onChange={(e) => setGrantEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="grant-amount">Token Amount</Label>
                <Input
                  id="grant-amount"
                  type="number"
                  min={1}
                  placeholder="100"
                  value={grantAmount}
                  onChange={(e) => setGrantAmount(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="grant-note">Note (optional)</Label>
                <Input
                  id="grant-note"
                  type="text"
                  placeholder="e.g. customer support credit"
                  value={grantNote}
                  onChange={(e) => setGrantNote(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={granting} className="w-full">
                {granting ? "Issuing..." : "Issue Grant"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
