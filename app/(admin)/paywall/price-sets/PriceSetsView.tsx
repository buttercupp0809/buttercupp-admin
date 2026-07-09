"use client";

import { useEffect, useMemo, useState } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2, Plus, Trash2 } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

const PPP_TIERS = ["T0", "T1", "T2", "T3", "T4"] as const;
type Tier = (typeof PPP_TIERS)[number];
type Slot = "monthly" | "annual";
type DodoProductsMap = Partial<Record<Tier, Partial<Record<Slot, string>>>>;

interface PriceSnapshotEntry {
  monthlyCents?: number;
  annualYearlyCents?: number;
  currency?: string;
}

export interface PaywallPriceSet {
  id: string;
  key: string;
  label: string;
  active: boolean;
  dodoProducts: DodoProductsMap;
  priceSnapshot: Record<string, PriceSnapshotEntry> | null;
  lastValidated: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ValidationResult {
  ok: boolean;
  priceCents?: number;
  currency?: string;
  interval?: Slot;
  error?: string;
}

interface DodoProductOption {
  id: string;
  name: string;
  priceCents: number | null;
  currency: string | null;
  recurring: boolean;
}

function formatCents(cents: number | undefined, currency: string | undefined): string {
  if (cents === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(cents / 100);
}

function emptyForm(): { key: string; label: string; active: boolean; dodoProducts: DodoProductsMap } {
  return { key: "", label: "", active: true, dodoProducts: {} };
}

type DodoEnvironment = "live_mode" | "test_mode";

export function PriceSetsView({
  initial,
  dodoEnvironment,
}: {
  initial: PaywallPriceSet[];
  dodoEnvironment: DodoEnvironment;
}) {
  const [priceSets, setPriceSets] = useState<PaywallPriceSet[]>(initial);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PaywallPriceSet | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [results, setResults] = useState<Record<string, ValidationResult> | null>(null);
  const [validatedJson, setValidatedJson] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dodoProductOptions, setDodoProductOptions] = useState<DodoProductOption[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<PaywallPriceSet | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Existing Dodo products for product-id autocomplete. Fetched lazily the
  // first time the editor opens. Fail-open: the id inputs stay plain text.
  useEffect(() => {
    if (!open || dodoProductOptions.length > 0) return;
    let cancelled = false;
    fetch("/api/paywall/dodo-products/list", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.products) setDodoProductOptions(d.products);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, dodoProductOptions.length]);

  const currentJson = useMemo(() => JSON.stringify(form.dodoProducts), [form.dodoProducts]);
  const isValidatedForCurrentInput = results !== null && validatedJson === currentJson;
  const overallValid =
    isValidatedForCurrentInput &&
    Object.values(results ?? {}).length > 0 &&
    Object.values(results ?? {}).every((r) => r.ok);

  async function refresh() {
    const res = await fetch("/api/paywall/price-sets", { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as { priceSets: PaywallPriceSet[] };
      setPriceSets(data.priceSets);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setResults(null);
    setValidatedJson(null);
    setOpen(true);
  }

  function openEdit(ps: PaywallPriceSet) {
    setEditing(ps);
    setForm({ key: ps.key, label: ps.label, active: ps.active, dodoProducts: ps.dodoProducts });
    setResults(null);
    setValidatedJson(null);
    setOpen(true);
  }

  function setSlot(tier: Tier, slot: Slot, value: string) {
    setForm((f) => ({
      ...f,
      dodoProducts: {
        ...f.dodoProducts,
        [tier]: { ...f.dodoProducts[tier], [slot]: value || undefined },
      },
    }));
  }

  function hasAnyProduct() {
    return Object.values(form.dodoProducts).some((s) => s && (s.monthly || s.annual));
  }

  async function handleValidate() {
    if (!hasAnyProduct()) {
      toast.error("Add at least one Dodo product ID first");
      return;
    }
    setValidating(true);
    try {
      const res = await fetch("/api/paywall/validate-dodo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dodoProducts: form.dodoProducts }),
      });
      const data = await res.json();
      setResults(data.results ?? {});
      setValidatedJson(currentJson);
      if (data.valid) {
        toast.success("All listed products validated");
      } else {
        toast.error("Some products failed validation — see details below");
      }
    } catch {
      toast.error("Validation request failed");
    } finally {
      setValidating(false);
    }
  }

  async function handleSave() {
    if (!form.key.trim() || !form.label.trim()) {
      toast.error("Key and label are required");
      return;
    }
    if (!hasAnyProduct()) {
      toast.error("Add at least one Dodo product ID first");
      return;
    }
    if (!overallValid) {
      toast.error('Click "Validate against Dodo" and resolve every error first');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/paywall/price-sets", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, id: editing?.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.results) setResults(data.results);
        toast.error(data.error || "Failed to save price set");
        return;
      }
      toast.success(`Price set "${form.key}" saved`);
      setOpen(false);
      await refresh();
    } catch {
      toast.error("Save request failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/paywall/price-sets?id=${encodeURIComponent(deleteTarget.id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to delete price set");
        return;
      }
      toast.success(`Price set "${deleteTarget.key}" deleted`);
      setDeleteTarget(null);
      await refresh();
    } catch {
      toast.error("Delete request failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New price set
        </Button>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Prices (from last validation)</TableHead>
              <TableHead>Last validated</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {priceSets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No price sets yet.
                </TableCell>
              </TableRow>
            ) : (
              priceSets.map((ps, index) => (
                <TableRow key={ps.id}>
                  <TableCell className="font-mono text-xs">{ps.key}</TableCell>
                  <TableCell className="font-medium">{ps.label}</TableCell>
                  <TableCell>
                    <Badge variant={ps.active ? "default" : "outline"}>
                      {ps.active ? "active" : "inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {ps.priceSnapshot && Object.keys(ps.priceSnapshot).length > 0 ? (
                        PPP_TIERS.filter((t) => ps.priceSnapshot?.[t]).map((tier) => {
                          const snap = ps.priceSnapshot![tier];
                          return (
                            <Badge key={tier} variant="secondary" className="font-normal">
                              {tier}: {formatCents(snap.monthlyCents, snap.currency)}/mo
                              {snap.annualYearlyCents !== undefined &&
                                ` · ${formatCents(snap.annualYearlyCents, snap.currency)}/yr`}
                            </Badge>
                          );
                        })
                      ) : (
                        <span className="text-muted-foreground text-xs">Not validated</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {ps.lastValidated ? formatDateTime(ps.lastValidated) : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Button variant="outline" size="sm" onClick={() => openEdit(ps)}>
                        Edit
                      </Button>
                      {index > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(ps)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
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
            <DialogTitle className="flex items-center gap-2">
              {editing ? `Edit ${editing.key}` : "New price set"}
              <Badge
                variant={dodoEnvironment === "live_mode" ? "destructive" : "outline"}
                className="text-[0.65rem]"
              >
                {dodoEnvironment === "live_mode" ? "LIVE" : "TEST"}
              </Badge>
            </DialogTitle>
            <DialogDescription>
              Every product ID must validate against Dodo before this can be saved.
              {dodoEnvironment === "live_mode" &&
                " You are connected to the LIVE Dodo account — created products are real."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ps-key">Key</Label>
                <Input
                  id="ps-key"
                  value={form.key}
                  disabled={!!editing}
                  onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
                  placeholder="default"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ps-label">Label</Label>
                <Input
                  id="ps-label"
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="Default (env PPP)"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              />
              Active
            </label>

            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                Dodo products per PPP tier
              </Label>
              {/* Shared suggestions for every product-id input. The Dodo list
                  response carries no interval, so both slots share one list;
                  validate-dodo still enforces interval correctness on save. */}
              {dodoProductOptions.length > 0 && (
                <datalist id="dodo-product-options">
                  {dodoProductOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.priceCents != null
                        ? ` — ${formatCents(p.priceCents, p.currency ?? "USD")}`
                        : ""}
                    </option>
                  ))}
                </datalist>
              )}
              {PPP_TIERS.map((tier) => (
                <div key={tier} className="grid grid-cols-[2.5rem_1fr_1fr] items-start gap-2">
                  <span className="text-xs font-mono pt-2 text-muted-foreground">{tier}</span>
                  <div className="space-y-1">
                    <SlotInput
                      placeholder="monthly product id"
                      value={form.dodoProducts[tier]?.monthly ?? ""}
                      onChange={(v) => setSlot(tier, "monthly", v)}
                      result={results?.[`${tier}.monthly`]}
                      listId={dodoProductOptions.length > 0 ? "dodo-product-options" : undefined}
                    />
                    <CreateProductMiniForm
                      tier={tier}
                      slot="monthly"
                      environment={dodoEnvironment}
                      existingProductId={form.dodoProducts[tier]?.monthly || undefined}
                      existingName={dodoProductOptions.find(p => p.id === form.dodoProducts[tier]?.monthly)?.name}
                      existingPriceCents={dodoProductOptions.find(p => p.id === form.dodoProducts[tier]?.monthly)?.priceCents ?? undefined}
                      onCreated={(id) => setSlot(tier, "monthly", id)}
                    />
                  </div>
                  <div className="space-y-1">
                    <SlotInput
                      placeholder="annual product id"
                      value={form.dodoProducts[tier]?.annual ?? ""}
                      onChange={(v) => setSlot(tier, "annual", v)}
                      result={results?.[`${tier}.annual`]}
                      listId={dodoProductOptions.length > 0 ? "dodo-product-options" : undefined}
                    />
                    <CreateProductMiniForm
                      tier={tier}
                      slot="annual"
                      environment={dodoEnvironment}
                      existingProductId={form.dodoProducts[tier]?.annual || undefined}
                      existingName={dodoProductOptions.find(p => p.id === form.dodoProducts[tier]?.annual)?.name}
                      existingPriceCents={dodoProductOptions.find(p => p.id === form.dodoProducts[tier]?.annual)?.priceCents ?? undefined}
                      onCreated={(id) => setSlot(tier, "annual", id)}
                    />
                  </div>
                </div>
              ))}
            </div>

            {isValidatedForCurrentInput && (
              <div
                className={`rounded-md border px-3 py-2 text-xs ${
                  overallValid
                    ? "border-green-200 bg-green-50 text-green-800"
                    : "border-destructive/30 bg-destructive/5 text-destructive"
                }`}
              >
                {overallValid
                  ? "All listed products validated against Dodo."
                  : "One or more products failed validation — fix the highlighted slots and re-validate."}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleValidate} disabled={validating}>
              {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Validate against Dodo
            </Button>
            <Button onClick={handleSave} disabled={saving || !overallValid}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete price set?</DialogTitle>
            <DialogDescription>
              This permanently removes &quot;{deleteTarget?.key}&quot;. Any variant still pointing
              at this price set must be re-pointed first.
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

function SlotInput({
  placeholder,
  value,
  onChange,
  result,
  listId,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  result?: ValidationResult;
  listId?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="relative">
        <Input
          value={value}
          list={listId}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="font-mono text-xs pr-7"
        />
        {result && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2">
            {result.ok ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <XCircle className="h-4 w-4 text-destructive" />
            )}
          </span>
        )}
      </div>
      {result?.ok && (
        <p className="text-[0.65rem] text-muted-foreground">
          {formatCents(result.priceCents, result.currency)} · {result.interval}
        </p>
      )}
      {result && !result.ok && (
        <p className="text-[0.65rem] text-destructive">{result.error}</p>
      )}
    </div>
  );
}

// Create + Edit mini-form for a single Dodo product slot.
// When `existingProductId` is set: shows "Edit product" trigger and calls the
// update endpoint (PUT /api/paywall/dodo-products/update).
// When empty: shows "+ Create new product" trigger and calls the create endpoint.
// All 3 fields (name, price, trial days) are editable in both modes.
function CreateProductMiniForm({
  tier,
  slot,
  environment,
  existingProductId,
  existingName,
  existingPriceCents,
  onCreated,
}: {
  tier: Tier;
  slot: Slot;
  environment: DodoEnvironment;
  existingProductId?: string;
  existingName?: string;
  existingPriceCents?: number;
  onCreated: (productId: string) => void;
}) {
  const isEdit = Boolean(existingProductId);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [dollars, setDollars] = useState("");
  const [trialDays, setTrialDays] = useState("");
  const [busy, setBusy] = useState(false);

  function handleOpen() {
    setName(existingName ?? "");
    setDollars(existingPriceCents ? (existingPriceCents / 100).toFixed(2) : "");
    setTrialDays("");
    setOpen(true);
  }

  async function handleSubmit() {
    const amount = parseFloat(dollars);
    if (!amount || amount <= 0) {
      toast.error("Enter a valid price in dollars");
      return;
    }
    const trial = parseInt(trialDays, 10);
    setBusy(true);
    try {
      let res: Response;
      if (isEdit && existingProductId) {
        res = await fetch("/api/paywall/dodo-products/update", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: existingProductId,
            name: name.trim() || undefined,
            interval: slot,
            priceCents: Math.round(amount * 100),
            ...(trialDays !== "" ? { trialPeriodDays: Number.isNaN(trial) ? 0 : trial } : {}),
          }),
        });
      } else {
        res = await fetch("/api/paywall/dodo-products/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: `${tier} ${slot}`,
            name: name.trim() || undefined,
            interval: slot,
            priceCents: Math.round(amount * 100),
            trialPeriodDays: Number.isNaN(trial) ? 0 : trial,
          }),
        });
      }
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || (isEdit ? "Failed to update product" : "Failed to create product"));
        return;
      }
      const env = data.environment === "live_mode" ? "live" : "test";
      toast.success(
        isEdit
          ? `Updated ${existingProductId} (${env}) — re-validate to refresh snapshot`
          : `Created ${data.productId} (${env}) — re-validate to snapshot it`,
      );
      onCreated(isEdit ? existingProductId! : data.productId);
      setOpen(false);
    } catch {
      toast.error(isEdit ? "Update request failed" : "Create request failed");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="flex gap-3">
        {!isEdit && (
          <button
            type="button"
            onClick={handleOpen}
            className="text-[0.65rem] text-primary hover:underline"
          >
            + Create new product
          </button>
        )}
        {isEdit && (
          <button
            type="button"
            onClick={handleOpen}
            className="text-[0.65rem] text-muted-foreground hover:text-foreground hover:underline"
          >
            Edit product
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5 rounded-md border bg-muted/30 p-2">
      <div className="flex items-center gap-1.5">
        <Badge
          variant={environment === "live_mode" ? "destructive" : "outline"}
          className="text-[0.6rem]"
        >
          {environment === "live_mode" ? "LIVE" : "TEST"}
        </Badge>
        <span className="text-[0.65rem] text-muted-foreground">
          {isEdit ? "Edit product" : (slot === "annual" ? "Yearly total, $" : "Monthly price, $")}
        </span>
      </div>
      {isEdit && (
        <p className="text-[0.6rem] font-mono text-muted-foreground truncate">{existingProductId}</p>
      )}
      <Input
        type="text"
        placeholder={`Product name (e.g. ${tier} ${slot})`}
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-7 text-xs"
      />
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          min="0"
          step="0.01"
          placeholder={slot === "annual" ? "144.00" : "19.00"}
          value={dollars}
          onChange={(e) => setDollars(e.target.value)}
          className="h-7 text-xs"
          title={slot === "annual" ? "Yearly total in dollars (e.g. 144.00 = $144/yr)" : "Monthly price in dollars"}
        />
        <Input
          type="number"
          min="0"
          step="1"
          title={isEdit ? "Free trial days — leave blank to keep existing" : "Free trial days (0 = no trial)"}
          placeholder={isEdit ? "keep" : "5"}
          value={trialDays}
          onChange={(e) => setTrialDays(e.target.value)}
          className="h-7 w-16 text-xs"
        />
      </div>
      <div className="flex gap-1.5">
        <Button size="xs" onClick={handleSubmit} disabled={busy}>
          {busy ? (isEdit ? "Updating…" : "Creating…") : (isEdit ? "Update" : "Create")}
        </Button>
        <Button size="xs" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
