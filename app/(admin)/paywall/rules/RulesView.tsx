"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import { AlertTriangle, HelpCircle, Plus, Power, Trash2, X } from "lucide-react";

// Portal tooltip: rendered into document.body to escape overflow-clipped
// containers and dialog stacking contexts. The icon span and tooltip are
// separate DOM subtrees so mounting the tooltip never triggers mouseleave.
const TOOLTIP_W = 224; // w-56 = 14rem = 224px
function Tip({ children, tip }: { children: React.ReactNode; tip: string }) {
  const iconRef = useRef<HTMLSpanElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const margin = 8;
  const vw = typeof window !== "undefined" ? window.innerWidth : 800;
  const tooltipLeft = rect
    ? Math.max(margin, Math.min(rect.left + rect.width / 2 - TOOLTIP_W / 2, vw - TOOLTIP_W - margin))
    : 0;
  const caretLeft = rect ? rect.left + rect.width / 2 - tooltipLeft : 0;

  const tooltip =
    rect && typeof document !== "undefined"
      ? createPortal(
          <span
            role="tooltip"
            className="pointer-events-none fixed z-[9999] w-56 rounded-md bg-foreground px-2.5 py-1.5 text-[11px] leading-snug text-background shadow-md"
            style={{ left: tooltipLeft, top: rect.top - 6, transform: "translateY(-100%)" }}
          >
            {tip}
            <span
              className="absolute top-full border-4 border-transparent border-t-foreground"
              style={{ left: caretLeft - 4 }}
            />
          </span>,
          document.body
        )
      : null;

  return (
    <span className="flex items-center gap-1">
      {children}
      <span
        ref={iconRef}
        className="inline-flex cursor-help"
        onMouseEnter={() => setRect(iconRef.current?.getBoundingClientRect() ?? null)}
        onMouseLeave={() => setRect(null)}
      >
        <HelpCircle className="h-3 w-3 text-muted-foreground shrink-0" />
      </span>
      {tooltip}
    </span>
  );
}

export interface PaywallRule {
  id: string;
  key: string;
  name: string;
  status: string;
  priority: number;
  matchCampaigns: string[];
  matchVariantParams: string[];
  countryIn: string[];
  arms: { variantKey: string; weight: number }[];
  version: number;
  updatedAt: string;
}

interface VariantOption {
  key: string;
  name: string;
  status: string;
}

interface RuleFormState {
  key: string;
  name: string;
  status: "off" | "live";
  matchCampaigns: string[];
  matchVariantParams: string[];
  countryIn: string[];
  priority: string;
  variantKey: string;
}

function emptyForm(): RuleFormState {
  return {
    key: "",
    name: "",
    status: "off",
    matchCampaigns: [],
    matchVariantParams: [],
    countryIn: [],
    priority: "100",
    variantKey: "",
  };
}

interface ChipOption {
  value: string;
  label?: string;
}

function ChipsInput({
  values,
  onChange,
  placeholder,
  uppercase,
  options,
  restrict,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  uppercase?: boolean;
  // Autocomplete suggestions rendered into a <datalist>. Free text is still
  // accepted unless `restrict` is set (used for the constrained country field).
  options?: ChipOption[];
  restrict?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const listId = useId();

  function add() {
    const v = uppercase ? draft.trim().toUpperCase() : draft.trim();
    if (!v || values.includes(v)) {
      setDraft("");
      return;
    }
    if (restrict && options && !options.some((o) => o.value === v)) {
      toast.error(`"${v}" is not a valid option`);
      return;
    }
    onChange([...values, v]);
    setDraft("");
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <Badge key={v} variant="secondary" className="gap-1 font-normal font-mono text-xs">
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-1.5">
        <Input
          value={draft}
          list={options && options.length > 0 ? listId : undefined}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="max-w-xs"
        />
        {options && options.length > 0 && (
          <datalist id={listId}>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label ?? o.value}
              </option>
            ))}
          </datalist>
        )}
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>
    </div>
  );
}

export function RulesView({
  initial,
  activeVariants,
}: {
  initial: PaywallRule[];
  activeVariants: VariantOption[];
}) {
  const [rules, setRules] = useState<PaywallRule[]>(initial);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PaywallRule | null>(null);
  const [form, setForm] = useState<RuleFormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [killOpen, setKillOpen] = useState(false);
  const [killing, setKilling] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PaywallRule | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [options, setOptions] = useState<{
    campaigns: string[];
    variantParams: string[];
    countries: { code: string; label: string }[];
  }>({ campaigns: [], variantParams: [], countries: [] });

  // Autocomplete suggestions from real data. Fail-open: on error the inputs
  // stay as plain free-text.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/paywall/options", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setOptions(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function refresh() {
    const res = await fetch("/api/paywall/rules", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setRules(data.rules);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setOpen(true);
  }

  function openEdit(rule: PaywallRule) {
    setEditing(rule);
    setForm({
      key: rule.key,
      name: rule.name,
      status: rule.status === "live" ? "live" : "off",
      matchCampaigns: rule.matchCampaigns,
      matchVariantParams: rule.matchVariantParams,
      countryIn: rule.countryIn,
      priority: String(rule.priority),
      variantKey: rule.arms[0]?.variantKey || "",
    });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.key.trim() || !form.name.trim()) {
      toast.error("Key and name are required");
      return;
    }
    if (!form.variantKey) {
      toast.error("Select a variant to pin this rule to");
      return;
    }
    const priority = parseInt(form.priority, 10);
    if (!Number.isInteger(priority)) {
      toast.error("Priority must be an integer");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/paywall/rules", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editing?.id,
          key: form.key,
          name: form.name,
          status: form.status,
          matchCampaigns: form.matchCampaigns,
          matchVariantParams: form.matchVariantParams,
          countryIn: form.countryIn,
          priority,
          variantKey: form.variantKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to save rule");
        return;
      }
      toast.success(`Rule "${form.key}" saved`);
      if (data.warning) {
        toast.warning(data.warning, { duration: 8000 });
      }
      setOpen(false);
      await refresh();
    } catch {
      toast.error("Save request failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleKillSwitch() {
    setKilling(true);
    try {
      const res = await fetch("/api/paywall/rules/kill-switch", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to turn rules off");
        return;
      }
      toast.success(`${data.updated} rule(s) turned off. All traffic now sees control.`);
      setKillOpen(false);
      await refresh();
    } catch {
      toast.error("Kill switch request failed");
    } finally {
      setKilling(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/paywall/rules?id=${encodeURIComponent(deleteTarget.id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to delete rule");
        return;
      }
      toast.success(`Rule "${deleteTarget.key}" deleted`);
      setDeleteTarget(null);
      await refresh();
    } catch {
      toast.error("Delete request failed");
    } finally {
      setDeleting(false);
    }
  }

  const liveCount = rules.filter((r) => r.status === "live").length;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Button
          variant="destructive"
          onClick={() => setKillOpen(true)}
          disabled={liveCount === 0}
        >
          <Power className="h-4 w-4" />
          Turn all rules OFF ({liveCount} live)
        </Button>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New rule
        </Button>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Campaigns</TableHead>
              <TableHead>Variant</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No rules yet.
                </TableCell>
              </TableRow>
            ) : (
              rules.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.key}</TableCell>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === "live" ? "default" : "outline"}>
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{r.priority}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {r.matchCampaigns.length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        r.matchCampaigns.map((c) => (
                          <Badge key={c} variant="secondary" className="font-normal text-[0.65rem]">
                            {c}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {r.arms[0]?.variantKey || "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Button variant="outline" size="sm" onClick={() => openEdit(r)}>
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(r)}
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.key}` : "New rule"}</DialogTitle>
            <DialogDescription>
              Binds campaigns/params to a single pinned variant. Multi-arm weighted
              rollout is supported by the schema but not exposed here yet.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label><Tip tip="Unique identifier for this rule. Immutable after creation. Conventionally matches the utm_campaign value so the key is self-documenting.">Key</Tip></Label>
                <Input
                  value={form.key}
                  disabled={!!editing}
                  onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
                  placeholder="e.g. black_friday"
                  className="font-mono text-xs"
                />
                <p className="text-[0.65rem] text-muted-foreground">
                  Usually the utm_campaign value.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label><Tip tip="Human-readable label shown in the rules table. Not used for matching — only for your reference.">Name</Tip></Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Black Friday 2026"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label><Tip tip="When two live rules both match the same traffic, the one with the lower priority number wins. Use 10, 20, 30 spacing to leave room for future rules.">Priority</Tip></Label>
                <Input
                  type="number"
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                />
                <p className="text-[0.65rem] text-muted-foreground">Lower number wins ties.</p>
              </div>
              <div className="space-y-1.5">
                <Label><Tip tip="'live' means this rule actively matches traffic. 'off' is the kill switch — set to off to instantly revert matched users to the control paywall without deleting the rule.">Status</Tip></Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((f) => ({ ...f, status: v as "off" | "live" }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="off">off</SelectItem>
                    <SelectItem value="live">live</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label><Tip tip="The paywall variant this rule sends matched users to. Must be an active variant. All matched traffic goes here (100% direct pin in v1).">Variant</Tip></Label>
              <Select
                value={form.variantKey || undefined}
                onValueChange={(v) => setForm((f) => ({ ...f, variantKey: v ?? "" }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select an active variant…" />
                </SelectTrigger>
                <SelectContent>
                  {activeVariants.length === 0 ? (
                    <SelectItem value="__none__" disabled>
                      No active variants yet
                    </SelectItem>
                  ) : (
                    activeVariants.map((v) => (
                      <SelectItem key={v.key} value={v.key}>
                        {v.name} ({v.key})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-[0.65rem] text-muted-foreground">
                Direct-pin only in v1: this rule always sends 100% of matched traffic here.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label><Tip tip="The utm_campaign values in ad URLs that trigger this rule. e.g. if your Meta ad destination URL has ?utm_campaign=black_friday, add 'black_friday' here. Multiple values = any of them matches.">Match campaigns (utm_campaign)</Tip></Label>
              <ChipsInput
                values={form.matchCampaigns}
                onChange={(v) => setForm((f) => ({ ...f, matchCampaigns: v }))}
                placeholder="e.g. black_friday"
                options={options.campaigns.map((c) => ({ value: c }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label><Tip tip="Direct URL param triggers. If someone opens the payment page with ?paywall=bf25 or ?variant=bf25, and 'bf25' is listed here, this rule fires regardless of utm_campaign. Useful for sharing a specific paywall via a link.">Match variant params (?paywall=/?variant=)</Tip></Label>
              <ChipsInput
                values={form.matchVariantParams}
                onChange={(v) => setForm((f) => ({ ...f, matchVariantParams: v }))}
                placeholder="e.g. bf25"
                options={options.variantParams.map((v) => ({ value: v }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label><Tip tip="Restrict this rule to users from specific countries (ISO-2 codes, e.g. US, GB, IN). Leave empty to match all countries. Useful when a campaign only targets a specific market and you don't want it affecting users elsewhere.">Country scoping (optional, ISO-2)</Tip></Label>
              <ChipsInput
                values={form.countryIn}
                onChange={(v) => setForm((f) => ({ ...f, countryIn: v }))}
                placeholder="e.g. US"
                uppercase
                restrict
                options={options.countries.map((c) => ({
                  value: c.code,
                  label: `${c.code} — ${c.label}`,
                }))}
              />
              <p className="text-[0.65rem] text-muted-foreground">
                Empty = all countries. Scopes campaign matching to paid-ad markets only.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={killOpen} onOpenChange={setKillOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Turn all rules off?
            </DialogTitle>
            <DialogDescription>
              This instantly reverts every visitor to the control paywall. {liveCount} live
              rule(s) will be turned off. No deploy needed, and rules can be turned back on
              individually afterward.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKillOpen(false)} disabled={killing}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleKillSwitch} disabled={killing}>
              {killing ? "Turning off…" : "Yes, turn everything off"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete rule?</DialogTitle>
            <DialogDescription>
              This permanently removes &quot;{deleteTarget?.key}&quot;. If it&apos;s live, matched
              traffic falls back to control immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
