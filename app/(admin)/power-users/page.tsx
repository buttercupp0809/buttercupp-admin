"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

interface PowerUser {
  id: string;
  email: string;
  subscriptionTier: string;
  tokenBalance: number;
  createdAt: string;
  totalMessages: number;
}

export default function PowerUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<PowerUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/power-users");
    const data = await res.json();
    setUsers(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

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
          Top 50 users by total message count across all conversations
        </p>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Rank</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="w-32">Tier</TableHead>
              <TableHead className="w-36 text-right">Token Balance</TableHead>
              <TableHead className="w-32 text-right">Total Messages</TableHead>
              <TableHead className="w-32 text-right">Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No data available
                </TableCell>
              </TableRow>
            ) : (
              users.map((u, idx) => (
                <TableRow
                  key={u.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/users/${u.id}`)}
                >
                  <TableCell>
                    <RankBadge rank={idx + 1} />
                  </TableCell>
                  <TableCell className="text-sm font-medium">{u.email}</TableCell>
                  <TableCell>
                    <Badge
                      variant={u.subscriptionTier === "free" ? "secondary" : "default"}
                      className="text-xs capitalize"
                    >
                      {u.subscriptionTier}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {u.tokenBalance.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {u.totalMessages.toLocaleString()}
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
