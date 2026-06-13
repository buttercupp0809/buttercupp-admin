"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Flame, Trophy } from "lucide-react";
import { formatDate } from "@/lib/utils";

type Period = "daily" | "weekly" | "monthly" | "quarterly";

interface PowerUser {
  rank: number;
  id: string;
  email: string;
  name: string;
  platform: string;
  subscriptionTier: string;
  createdAt: string;
  messageCount: number;
}

const PERIOD_LABEL: Record<Period, string> = {
  daily: "Today",
  weekly: "Last 7 days",
  monthly: "Last 30 days",
  quarterly: "Last 90 days",
};

export default function PowerUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<PowerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("weekly");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/power-users?period=${period}&limit=50`);
    const data = await res.json();
    setUsers(data.users || []);
    setLoading(false);
  }, [period]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Flame className="h-6 w-6 text-orange-500" />
          Power Users
        </h1>
        <p className="text-muted-foreground mt-1">
          Top 50 users by message volume — {PERIOD_LABEL[period].toLowerCase()}
        </p>
      </div>

      <div className="flex gap-1">
        {(["daily", "weekly", "monthly", "quarterly"] as Period[]).map((p) => (
          <Button
            key={p}
            variant={period === p ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriod(p)}
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </Button>
        ))}
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Rank</TableHead>
              <TableHead>User</TableHead>
              <TableHead className="w-32">Platform</TableHead>
              <TableHead className="w-32">Tier</TableHead>
              <TableHead className="w-32 text-right">Messages</TableHead>
              <TableHead className="w-32 text-right">Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No activity in this period
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => (
                <TableRow
                  key={u.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/users/${u.id}`)}
                >
                  <TableCell>
                    <RankBadge rank={u.rank} />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{u.name}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{u.platform}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={u.subscriptionTier === "free" ? "secondary" : "default"}
                    >
                      {u.subscriptionTier}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {u.messageCount.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground text-xs">
                    {formatDate(u.createdAt)}
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

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="inline-flex items-center gap-1 text-amber-500 font-semibold">
        <Trophy className="h-4 w-4" />1
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex items-center gap-1 text-zinc-400 font-semibold">
        <Trophy className="h-4 w-4" />2
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="inline-flex items-center gap-1 text-orange-600 font-semibold">
        <Trophy className="h-4 w-4" />3
      </span>
    );
  }
  return <span className="font-mono text-sm text-muted-foreground">#{rank}</span>;
}
