"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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
import { ShieldAlert } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

type LevelFilter = "all" | "1" | "2" | "3" | "4" | "5";

interface CrisisEventRow {
  id: string;
  userId: string;
  level: number;
  trigger: string;
  action: string;
  createdAt: string;
  user: { id: string; email: string };
}

function LevelBadge({ level }: { level: number }) {
  const styles: Record<number, string> = {
    1: "bg-yellow-100 text-yellow-800",
    2: "bg-orange-100 text-orange-800",
    3: "bg-red-100 text-red-800",
    4: "bg-red-200 text-red-900",
    5: "bg-red-700 text-white",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${styles[level] ?? "bg-gray-100 text-gray-800"}`}
    >
      Level {level}
    </span>
  );
}

export default function CrisisEventsPage() {
  const [events, setEvents] = useState<CrisisEventRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [level, setLevel] = useState<LevelFilter>("all");
  const [loading, setLoading] = useState(true);

  const limit = 50;

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: page.toString(), level });
    const res = await fetch(`/api/crisis-events?${params}`);
    const data = await res.json();
    setEvents(data.events ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [page, level]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  function handleLevelChange(v: string | null) {
    if (!v) return;
    setLevel(v as LevelFilter);
    setPage(1);
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-red-500" />
          Crisis Events
        </h1>
        <p className="text-muted-foreground mt-1">
          User crisis triggers detected by the system
        </p>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Level:</span>
        <Select value={level} onValueChange={handleLevelChange}>
          <SelectTrigger className="w-[120px] h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="1">Level 1</SelectItem>
            <SelectItem value="2">Level 2</SelectItem>
            <SelectItem value="3">Level 3</SelectItem>
            <SelectItem value="4">Level 4</SelectItem>
            <SelectItem value="5">Level 5</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground ml-2">{total.toLocaleString()} events</span>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Level</TableHead>
              <TableHead>User Email</TableHead>
              <TableHead>Trigger</TableHead>
              <TableHead>Action</TableHead>
              <TableHead className="w-40">Created At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : events.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No crisis events found
                </TableCell>
              </TableRow>
            ) : (
              events.map((event) => (
                <TableRow
                  key={event.id}
                  className={event.level >= 3 ? "bg-red-50" : undefined}
                >
                  <TableCell>
                    <LevelBadge level={event.level} />
                  </TableCell>
                  <TableCell className="text-sm">
                    <Link
                      href={`/users/${event.user.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {event.user.email}
                    </Link>
                  </TableCell>
                  <TableCell
                    className="text-sm max-w-[220px] truncate"
                    title={event.trigger}
                  >
                    {event.trigger}
                  </TableCell>
                  <TableCell className="text-sm">{event.action}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateTime(event.createdAt)}
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
  );
}
