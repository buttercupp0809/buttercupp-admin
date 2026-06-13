"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Filter } from "lucide-react";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/utils";

type Priority = "critical" | "important" | "nice_to_have";
type Category = "bug" | "feature" | "improvement" | "general";
type Status = "new" | "acknowledged" | "in_progress" | "resolved";

interface FeedbackItem {
  id: string;
  userId: string;
  user: { id: string; email: string; name: string };
  priority: Priority;
  category: Category;
  status: Status;
  subject: string;
  body: string;
  rating: number | null;
  ratingLabel: string | null;
  source: string;
  isAnonymous: boolean;
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const PRIORITY_OPTIONS: { value: "" | Priority; label: string }[] = [
  { value: "", label: "All priorities" },
  { value: "critical", label: "Critical" },
  { value: "important", label: "Important" },
  { value: "nice_to_have", label: "Nice to have" },
];

const CATEGORY_OPTIONS: { value: "" | Category; label: string }[] = [
  { value: "", label: "All categories" },
  { value: "bug", label: "Bug" },
  { value: "feature", label: "Feature" },
  { value: "improvement", label: "Improvement" },
  { value: "general", label: "General" },
];

const STATUS_OPTIONS: { value: "" | Status; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "new", label: "New" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
];

const PRIORITY_LABEL: Record<Priority, string> = {
  critical: "Critical",
  important: "Important",
  nice_to_have: "Nice to have",
};

const STATUS_LABEL: Record<Status, string> = {
  new: "New",
  acknowledged: "Acknowledged",
  in_progress: "In progress",
  resolved: "Resolved",
};

function priorityVariant(p: Priority): "default" | "destructive" | "secondary" {
  if (p === "critical") return "destructive";
  if (p === "important") return "default";
  return "secondary";
}

function statusVariant(s: Status): "default" | "outline" | "secondary" {
  if (s === "resolved") return "secondary";
  if (s === "in_progress") return "default";
  return "outline";
}

export default function FeedbackPage() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [total, setTotal] = useState(0);
  const [criticalCount, setCriticalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [priority, setPriority] = useState<"" | Priority>("");
  const [category, setCategory] = useState<"" | Category>("");
  const [status, setStatus] = useState<"" | Status>("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [active, setActive] = useState<FeedbackItem | null>(null);
  const limit = 25;

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      ...(priority && { priority }),
      ...(category && { category }),
      ...(status && { status }),
      ...(search && { search }),
    });
    const res = await fetch(`/api/feedback?${params}`);
    const data = await res.json();
    setItems(data.items);
    setTotal(data.total);
    setCriticalCount(data.priorityCounts?.critical || 0);
    setLoading(false);
  }, [page, priority, category, status, search]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Feedback</h1>
          <p className="text-muted-foreground mt-1">
            Triage user feedback — high-alert tag on critical reports
          </p>
        </div>
        {criticalCount > 0 && (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            {criticalCount} critical
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Filter className="h-4 w-4" />
          <span className="text-xs font-medium">Filters</span>
        </div>
        <FilterSelect
          value={priority}
          onChange={(v) => {
            setPriority(v as "" | Priority);
            setPage(1);
          }}
          options={PRIORITY_OPTIONS}
        />
        <FilterSelect
          value={category}
          onChange={(v) => {
            setCategory(v as "" | Category);
            setPage(1);
          }}
          options={CATEGORY_OPTIONS}
        />
        <FilterSelect
          value={status}
          onChange={(v) => {
            setStatus(v as "" | Status);
            setPage(1);
          }}
          options={STATUS_OPTIONS}
        />
        <Input
          placeholder="Search subject, body, user…"
          className="max-w-xs ml-auto"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Priority</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead className="w-32">Category</TableHead>
              <TableHead className="w-40">User</TableHead>
              <TableHead className="w-32">Status</TableHead>
              <TableHead className="w-36 text-right">Submitted</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No feedback matches these filters
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow
                  key={item.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setActive(item)}
                >
                  <TableCell>
                    <Badge variant={priorityVariant(item.priority)} className="gap-1">
                      {item.priority === "critical" && (
                        <AlertTriangle className="h-3 w-3" />
                      )}
                      {PRIORITY_LABEL[item.priority]}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium max-w-md truncate">
                    {item.subject}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{item.category}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {item.isAnonymous ? (
                      <span className="text-muted-foreground italic">Anonymous</span>
                    ) : (
                      <div className="truncate">
                        <div>{item.user.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.user.email}
                        </div>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(item.status)}>
                      {STATUS_LABEL[item.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs text-right">
                    {formatDateTime(item.createdAt)}
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

      {active && (
        <FeedbackDetailDialog
          item={active}
          onClose={() => setActive(null)}
          onUpdated={(updated) => {
            setActive(updated);
            setItems((prev) =>
              prev.map((it) => (it.id === updated.id ? updated : it))
            );
          }}
        />
      )}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function FeedbackDetailDialog({
  item,
  onClose,
  onUpdated,
}: {
  item: FeedbackItem;
  onClose: () => void;
  onUpdated: (item: FeedbackItem) => void;
}) {
  const [status, setStatus] = useState<Status>(item.status);
  const [note, setNote] = useState(item.resolutionNote || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/feedback/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, resolutionNote: note }),
    });
    const data = await res.json();
    if (res.ok) {
      toast.success("Feedback updated");
      onUpdated(data);
    } else {
      toast.error(data.error || "Failed to update feedback");
    }
    setSaving(false);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-8">
            {item.priority === "critical" && (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            )}
            {item.subject}
          </DialogTitle>
          <DialogDescription>
            <span className="flex flex-wrap items-center gap-2 mt-1">
              <Badge variant={priorityVariant(item.priority)}>
                {PRIORITY_LABEL[item.priority]}
              </Badge>
              <Badge variant="outline">{item.category}</Badge>
              <Badge variant="outline">via {item.source}</Badge>
              {item.rating != null && (
                <Badge variant="secondary">
                  {item.rating}/5 {item.ratingLabel ? `· ${item.ratingLabel}` : ""}
                </Badge>
              )}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">From</p>
            {item.isAnonymous ? (
              <p className="text-sm italic">Anonymous</p>
            ) : (
              <div className="text-sm">
                <p className="font-medium">{item.user.name}</p>
                <p className="text-muted-foreground">{item.user.email}</p>
              </div>
            )}
            <p className="text-xs text-muted-foreground pt-1">
              Submitted {formatDateTime(item.createdAt)}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Body</p>
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm whitespace-pre-wrap">
              {item.body}
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Status</p>
            <FilterSelect
              value={status}
              onChange={(v) => setStatus(v as Status)}
              options={[
                { value: "new", label: "New" },
                { value: "acknowledged", label: "Acknowledged" },
                { value: "in_progress", label: "In progress" },
                { value: "resolved", label: "Resolved" },
              ]}
            />
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Resolution note</p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Internal note about the resolution (optional)"
              rows={3}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
