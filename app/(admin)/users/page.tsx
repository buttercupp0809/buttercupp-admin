"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { ArrowUpDown } from "lucide-react";
import { formatDate, formatCountry } from "@/lib/utils";

type Period = "daily" | "weekly" | "monthly" | "quarterly";
type View = "all" | "onboarding_incomplete" | "trial_active" | "trial_expiring" | "trial_expired";

interface UserRow {
  id: string;
  email: string;
  name: string;
  platform: string;
  subscriptionTier: string;
  country: string | null;
  createdAt: string;
  score: number;
  onboardingStep: number;
  onboardingComplete: boolean;
  trialEndsAt: string | null;
  trialStatus: string;
  daysLeftInTrial: number | null;
}

const VIEW_LABELS: Record<View, string> = {
  all: "All Users",
  onboarding_incomplete: "Onboarding Incomplete",
  trial_active: "Trial Active",
  trial_expiring: "Trial Expiring (7d)",
  trial_expired: "Trial Expired",
};

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("weekly");
  const [view, setView] = useState<View>("all");
  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const limit = 25;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      period,
      view,
      sort,
      order,
      page: page.toString(),
      limit: limit.toString(),
      ...(search && { search }),
    });
    const res = await fetch(`/api/users?${params}`);
    const data = await res.json();
    setUsers(data.users);
    setTotal(data.total);
    setLoading(false);
  }, [period, view, sort, order, page, search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  function toggleSort(col: string) {
    if (sort === col) {
      setOrder(order === "desc" ? "asc" : "desc");
    } else {
      setSort(col);
      setOrder("desc");
    }
  }

  function handleViewChange(v: string) {
    setView(v as View);
    setPage(1);
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-muted-foreground mt-1">
          Engagement scores based on user messages
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex flex-wrap gap-1">
            {(["daily", "weekly", "monthly", "quarterly"] as Period[]).map((p) => (
              <Button
                key={p}
                variant={period === p ? "default" : "outline"}
                size="sm"
                onClick={() => { setPeriod(p); setPage(1); }}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </Button>
            ))}
          </div>
          <Input
            placeholder="Search by name or email…"
            className="max-w-xs"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Segment:</span>
          <Select value={view} onValueChange={(v) => v && handleViewChange(v)}>
            <SelectTrigger className="w-[220px] h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(VIEW_LABELS) as View[]).map((v) => (
                <SelectItem key={v} value={v}>
                  {VIEW_LABELS[v]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {view !== "all" && (
            <span className="text-sm text-muted-foreground">
              {total.toLocaleString()} users
            </span>
          )}
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">ID</TableHead>
              <TableHead>
                <button onClick={() => toggleSort("email")} className="flex items-center gap-1 font-medium">
                  Email <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead>
                <button onClick={() => toggleSort("name")} className="flex items-center gap-1 font-medium">
                  Name <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead>Platform</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>
                <button onClick={() => toggleSort("onboardingStep")} className="flex items-center gap-1 font-medium">
                  Onboarding <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead>
                <button onClick={() => toggleSort("trialEndsAt")} className="flex items-center gap-1 font-medium">
                  Trial <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead>
                <button onClick={() => toggleSort("score")} className="flex items-center gap-1 font-medium">
                  Score <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead>
                <button onClick={() => toggleSort("createdAt")} className="flex items-center gap-1 font-medium">
                  Created <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow
                  key={user.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/users/${user.id}`)}
                >
                  <TableCell className="font-mono text-xs">
                    {user.id.slice(0, 8)}
                  </TableCell>
                  <TableCell className="text-sm">{user.email}</TableCell>
                  <TableCell className="text-sm">{user.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{user.platform}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {user.country ? (
                      <span title={user.country}>{formatCountry(user.country)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.subscriptionTier === "free" ? "secondary" : "default"} className="text-xs">
                      {user.subscriptionTier}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.onboardingComplete ? (
                      <Badge variant="default" className="text-xs bg-green-600 hover:bg-green-600">Done</Badge>
                    ) : user.onboardingStep > 0 ? (
                      <Badge variant="secondary" className="text-xs">Step {user.onboardingStep}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <TrialBadge
                      trialEndsAt={user.trialEndsAt}
                      daysLeft={user.daysLeftInTrial}
                      subscriptionTier={user.subscriptionTier}
                    />
                  </TableCell>
                  <TableCell className="font-semibold">{user.score}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(user.createdAt)}
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
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
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
  );
}

function TrialBadge({
  trialEndsAt,
  daysLeft,
  subscriptionTier,
}: {
  trialEndsAt: string | null;
  daysLeft: number | null;
  subscriptionTier: string;
}) {
  if (!trialEndsAt) return <span className="text-muted-foreground text-xs">—</span>;

  if (subscriptionTier !== "free") {
    return <Badge variant="default" className="text-xs bg-green-600 hover:bg-green-600">Converted</Badge>;
  }

  if (daysLeft !== null && daysLeft > 0) {
    return (
      <Badge
        variant={daysLeft <= 3 ? "destructive" : "secondary"}
        className="text-xs"
      >
        {daysLeft}d left
      </Badge>
    );
  }

  return <Badge variant="destructive" className="text-xs">Expired</Badge>;
}
