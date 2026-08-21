"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Flag, Plus, Pencil, Trash2 } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

interface FeatureFlag {
  id: string;
  key: string;
  enabled: boolean;
  rollout: number;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
}

interface FlagFormState {
  key: string;
  enabled: boolean;
  rollout: string;
  metadata: string;
}

const EMPTY_FORM: FlagFormState = {
  key: "",
  enabled: false,
  rollout: "0",
  metadata: "",
};

function flagToForm(flag: FeatureFlag): FlagFormState {
  return {
    key: flag.key,
    enabled: flag.enabled,
    rollout: String(flag.rollout),
    metadata: flag.metadata ? JSON.stringify(flag.metadata, null, 2) : "",
  };
}

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [editFlag, setEditFlag] = useState<FeatureFlag | null>(null);
  const [deleteFlag, setDeleteFlag] = useState<FeatureFlag | null>(null);

  const [form, setForm] = useState<FlagFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchFlags = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/feature-flags");
    const data = await res.json();
    setFlags(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setCreateOpen(true);
  }

  function openEdit(flag: FeatureFlag) {
    setForm(flagToForm(flag));
    setEditFlag(flag);
  }

  async function handleSaveCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.key.trim()) {
      toast.error("Key is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/feature-flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: form.key.trim(),
          enabled: form.enabled,
          rollout: parseInt(form.rollout) || 0,
          metadata: form.metadata.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to create flag");
      } else {
        toast.success(`Flag "${data.key}" created`);
        setCreateOpen(false);
        fetchFlags();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editFlag) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/feature-flags/${encodeURIComponent(editFlag.key)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: form.enabled,
          rollout: parseInt(form.rollout) || 0,
          metadata: form.metadata.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to update flag");
      } else {
        toast.success(`Flag "${data.key}" updated`);
        setEditFlag(null);
        fetchFlags();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(flag: FeatureFlag) {
    const res = await fetch(`/api/feature-flags/${encodeURIComponent(flag.key)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !flag.enabled }),
    });
    if (res.ok) {
      setFlags((prev) =>
        prev.map((f) => (f.key === flag.key ? { ...f, enabled: !f.enabled } : f))
      );
    } else {
      toast.error("Failed to toggle flag");
    }
  }

  async function handleDelete() {
    if (!deleteFlag) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/feature-flags/${encodeURIComponent(deleteFlag.key)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success(`Flag "${deleteFlag.key}" deleted`);
        setDeleteFlag(null);
        fetchFlags();
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Failed to delete flag");
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Flag className="h-6 w-6 text-blue-500" />
            Feature Flags
          </h1>
          <p className="text-muted-foreground mt-1">Manage feature flags and rollout percentages</p>
        </div>
        <Button onClick={openCreate} size="sm" className="flex items-center gap-1.5">
          <Plus className="h-4 w-4" />
          New Flag
        </Button>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              <TableHead className="w-24 text-center">Enabled</TableHead>
              <TableHead className="w-28 text-center">Rollout %</TableHead>
              <TableHead className="w-40">Created At</TableHead>
              <TableHead className="w-28 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : flags.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No feature flags defined
                </TableCell>
              </TableRow>
            ) : (
              flags.map((flag) => (
                <TableRow key={flag.id}>
                  <TableCell className="font-mono text-sm font-medium">{flag.key}</TableCell>
                  <TableCell className="text-center">
                    <button
                      onClick={() => handleToggle(flag)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                        flag.enabled ? "bg-green-500" : "bg-gray-300"
                      }`}
                      aria-label={flag.enabled ? "Disable flag" : "Enable flag"}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                          flag.enabled ? "translate-x-4.5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </TableCell>
                  <TableCell className="text-center tabular-nums">{flag.rollout}%</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateTime(flag.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEdit(flag)}
                        aria-label="Edit flag"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDeleteFlag(flag)}
                        aria-label="Delete flag"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Feature Flag</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveCreate} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="cf-key">Key</Label>
              <Input
                id="cf-key"
                placeholder="my_feature_flag"
                value={form.key}
                onChange={(e) => setForm({ ...form, key: e.target.value })}
                required
              />
            </div>
            <div className="flex items-center gap-3">
              <input
                id="cf-enabled"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300"
                checked={form.enabled}
                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              />
              <Label htmlFor="cf-enabled">Enabled</Label>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-rollout">Rollout % (0-100)</Label>
              <Input
                id="cf-rollout"
                type="number"
                min={0}
                max={100}
                value={form.rollout}
                onChange={(e) => setForm({ ...form, rollout: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-meta">Metadata (optional JSON)</Label>
              <textarea
                id="cf-meta"
                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder='{"description": "..."}'
                value={form.metadata}
                onChange={(e) => setForm({ ...form, metadata: e.target.value })}
              />
            </div>
            <DialogFooter showCloseButton>
              <Button type="submit" disabled={saving}>
                {saving ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editFlag} onOpenChange={(o) => { if (!o) setEditFlag(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Flag: {editFlag?.key}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveEdit} className="space-y-4 mt-2">
            <div className="flex items-center gap-3">
              <input
                id="ef-enabled"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300"
                checked={form.enabled}
                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              />
              <Label htmlFor="ef-enabled">Enabled</Label>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ef-rollout">Rollout % (0-100)</Label>
              <Input
                id="ef-rollout"
                type="number"
                min={0}
                max={100}
                value={form.rollout}
                onChange={(e) => setForm({ ...form, rollout: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ef-meta">Metadata (optional JSON)</Label>
              <textarea
                id="ef-meta"
                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder='{"description": "..."}'
                value={form.metadata}
                onChange={(e) => setForm({ ...form, metadata: e.target.value })}
              />
            </div>
            <DialogFooter showCloseButton>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteFlag} onOpenChange={(o) => { if (!o) setDeleteFlag(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Flag</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mt-1">
            Are you sure you want to delete the flag{" "}
            <span className="font-mono font-medium text-foreground">{deleteFlag?.key}</span>? This
            cannot be undone.
          </p>
          <DialogFooter showCloseButton className="mt-4">
            <Button variant="destructive" disabled={deleting} onClick={handleDelete}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
