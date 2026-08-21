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
import { formatDate } from "@/lib/utils";

type Tier = "all" | "free" | "premium" | "pro";

interface UserRow {
  id: string;
  email: string;
  subscriptionTier: string;
  tokenBalance: number;
  ageVerificationLevel: string;
  completedOnboardingAt: string | null;
  createdAt: string;
}

const TIER_OPTIONS: { value: Tier; label: string }[] = [
  { value: "all", label: "All Tiers" },
  { value: "free", label: "Free" },
  { value: "premium", label: "Premium" },
  { value: "pro", label: "Pro" },
];

function tierVariant(tier: string): "secondary" | "default" | "outline" {
  if (tier === "free") return "secondary";
  if (tier === "pro") return "default";
  return "outline";
}

function ageVerifVariant(level: string): "secondary" | "default" | "outline" {
  if (level === "vendor_verified") return "default";
  if (level === "self_declared") return "outline";
  return "secondary";
}

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<Tier>("all");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const limit = 25;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: page.toString(),
      tier,
      ...(search && { search }),
    });
    const res = await fetch(`/api/users?${params}`);
    const data = await res.json();
    setUsers(data.users);
    setTotal(data.total);
    setLoading(false);
  }, [page, tier, search]);

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

  function handleTierChange(v: string | null) {
    if (!v) return;
    setTier(v as Tier);
    setPage(1);
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-muted-foreground mt-1">
          {total.toLocaleString()} users total
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Tier:</span>
          <Select value={tier} onValueChange={(v) => v && handleTierChange(v)}>
            <SelectTrigger className="w-[160px] h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Input
          placeholder="Search by email..."
          className="max-w-xs"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead className="text-right">Token Balance</TableHead>
              <TableHead>Age Verification</TableHead>
              <TableHead>Onboarding</TableHead>
              <TableHead className="text-right">Created</TableHead>
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
                  <TableCell className="text-sm font-medium">{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={tierVariant(user.subscriptionTier)} className="text-xs capitalize">
                      {user.subscriptionTier}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {user.tokenBalance.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={ageVerifVariant(user.ageVerificationLevel)} className="text-xs">
                      {user.ageVerificationLevel.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.completedOnboardingAt ? (
                      <Badge variant="default" className="text-xs bg-green-600 hover:bg-green-600">
                        Complete
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        Incomplete
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground text-sm">
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
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total.toLocaleString()}
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
