"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_CONTENT,
  mergeWithDefaults,
  type PaywallContent,
  type PaywallVariant,
  type VariantStatus,
} from "../types";

interface PriceSetOption {
  id: string;
  key: string;
  label: string;
  active: boolean;
}

interface FormState {
  key: string;
  name: string;
  status: VariantStatus;
  priceSetKey: string; // "" = none / default PPP
  content: PaywallContent;
}

function emptyForm(): FormState {
  return {
    key: "",
    name: "",
    status: "draft",
    priceSetKey: "",
    content: structuredClone(DEFAULT_CONTENT),
  };
}

function formFromVariant(v: PaywallVariant): FormState {
  return {
    key: v.key,
    name: v.name,
    status: v.status,
    priceSetKey: v.priceSetKey ?? "",
    content: mergeWithDefaults(v.content),
  };
}

export default function VariantEditorPage() {
  const { key: keyParam } = useParams<{ key: string }>();
  const router = useRouter();
  const isNew = keyParam === "new";

  const [loading, setLoading] = useState(!isNew);
  const [notFound, setNotFound] = useState(false);
  const [variant, setVariant] = useState<PaywallVariant | null>(null);
  const [priceSets, setPriceSets] = useState<PriceSetOption[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [newBadge, setNewBadge] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const psRes = await fetch("/api/paywall/price-sets", { cache: "no-store" });
        if (!cancelled && psRes.ok) {
          const psData = (await psRes.json()) as { priceSets: PriceSetOption[] };
          setPriceSets(psData.priceSets.filter((p) => p.active));
        }

        if (!isNew) {
          const res = await fetch(`/api/paywall/variants?key=${encodeURIComponent(keyParam)}`, {
            cache: "no-store",
          });
          if (cancelled) return;
          if (!res.ok) {
            setNotFound(true);
            return;
          }
          const data = (await res.json()) as { variant: PaywallVariant };
          setVariant(data.variant);
          setForm(formFromVariant(data.variant));
        }
      } catch {
        if (!cancelled) toast.error("Failed to load variant");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isNew, keyParam]);

  function updateContent(patch: Partial<PaywallContent>) {
    setForm((f) => ({ ...f, content: { ...f.content, ...patch } }));
  }

  function updateCards(patch: Partial<PaywallContent["cards"]>) {
    setForm((f) => ({ ...f, content: { ...f.content, cards: { ...f.content.cards, ...patch } } }));
  }

  function updateCard(slot: "monthly" | "annual", patch: Partial<PaywallContent["cards"]["monthly"]>) {
    setForm((f) => ({
      ...f,
      content: {
        ...f.content,
        cards: { ...f.content.cards, [slot]: { ...f.content.cards[slot], ...patch } },
      },
    }));
  }

  function addBadge() {
    const trimmed = newBadge.trim();
    if (!trimmed) return;
    updateContent({ trustBadges: [...form.content.trustBadges, trimmed] });
    setNewBadge("");
  }

  function removeBadge(index: number) {
    updateContent({ trustBadges: form.content.trustBadges.filter((_, i) => i !== index) });
  }

  async function handleSave() {
    if (!form.key.trim() || !form.name.trim()) {
      toast.error("Key and name are required");
      return;
    }
    if (!form.content.headline.trim()) {
      toast.error("Headline is required");
      return;
    }
    if (!form.content.cta.label.trim()) {
      toast.error("CTA label is required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/paywall/variants", {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: variant?.id,
          key: form.key.trim(),
          name: form.name.trim(),
          status: form.status,
          priceSetKey: form.priceSetKey || null,
          content: form.content,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to save variant");
        return;
      }
      toast.success(`Variant "${data.variant.key}" saved (v${data.variant.version})`);
      setVariant(data.variant);
      setForm(formFromVariant(data.variant));
      if (isNew) {
        router.replace(`/paywall/variants/${data.variant.key}`);
      }
    } catch {
      toast.error("Save request failed");
    } finally {
      setSaving(false);
    }
  }

  async function handlePreview() {
    if (!variant) return;
    setPreviewing(true);
    try {
      const res = await fetch(`/api/paywall/variants/preview-link?key=${encodeURIComponent(variant.key)}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to build preview link");
        return;
      }
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Preview request failed");
    } finally {
      setPreviewing(false);
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Loading variant…</div>;
  }

  if (notFound) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/paywall/variants")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Variants
        </Button>
        <p className="text-muted-foreground">No variant found for key &quot;{keyParam}&quot;.</p>
      </div>
    );
  }

  const hasUnsavedChanges = !isNew && variant ? JSON.stringify(formFromVariant(variant)) !== JSON.stringify(form) : false;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push("/paywall/variants")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Variants
        </Button>
        {variant && <Badge variant="outline">v{variant.version}</Badge>}
      </div>

      <div>
        <h1 className="text-2xl font-bold">{isNew ? "New Variant" : `Edit ${variant?.key}`}</h1>
        <p className="text-muted-foreground mt-1">
          Typed fields map directly to the payment page&apos;s content. Save bumps the version;
          draft variants are only reachable via the signed preview link.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Basics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="v-key">Key</Label>
              <Input
                id="v-key"
                value={form.key}
                disabled={!isNew}
                onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
                placeholder="bf_25off"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-name">Name</Label>
              <Input
                id="v-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Black Friday 25% off"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => v && setForm((f) => ({ ...f, status: v as VariantStatus }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Price set</Label>
              <Select
                value={form.priceSetKey || "__none__"}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, priceSetKey: v === "__none__" ? "" : (v ?? "") }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None — default PPP</SelectItem>
                  {priceSets.map((ps) => (
                    <SelectItem key={ps.key} value={ps.key}>
                      {ps.label} ({ps.key})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Copy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="v-eyebrow">Eyebrow</Label>
            <Input
              id="v-eyebrow"
              value={form.content.eyebrow}
              onChange={(e) => updateContent({ eyebrow: e.target.value })}
              placeholder="Last step"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="v-headline">Headline</Label>
            <Input
              id="v-headline"
              value={form.content.headline}
              onChange={(e) => updateContent({ headline: e.target.value })}
              placeholder="Start your 5-day free trial"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="v-subheadline">Subheadline</Label>
            <Input
              id="v-subheadline"
              value={form.content.subheadline}
              onChange={(e) => updateContent({ subheadline: e.target.value })}
              placeholder="$0 today. Cancel anytime."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="v-cta">CTA label</Label>
            <Input
              id="v-cta"
              value={form.content.cta.label}
              onChange={(e) => updateContent({ cta: { label: e.target.value } })}
              placeholder="Start free trial · $0 due today"
            />
          </div>

          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input"
                checked={form.content.showChecklistAnimation}
                onChange={(e) => updateContent({ showChecklistAnimation: e.target.checked })}
              />
              Show checklist animation
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input"
                checked={form.content.showPersonalReflection}
                onChange={(e) => updateContent({ showPersonalReflection: e.target.checked })}
              />
              Show personal reflection
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Pricing cards</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input"
                checked={form.content.cards.showMonthly}
                onChange={(e) => updateCards({ showMonthly: e.target.checked })}
              />
              Show monthly card
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input"
                checked={form.content.cards.showAnnual}
                onChange={(e) => updateCards({ showAnnual: e.target.checked })}
              />
              Show annual card
            </label>
            <div className="flex items-center gap-2">
              <Label className="text-sm">Default selected</Label>
              <Select
                value={form.content.cards.defaultSelected}
                onValueChange={(v) => v && updateCards({ defaultSelected: v as "monthly" | "annual" })}
              >
                <SelectTrigger className="w-32" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <CardSlotEditor
              title="Monthly card"
              card={form.content.cards.monthly}
              onChange={(patch) => updateCard("monthly", patch)}
            />
            <CardSlotEditor
              title="Annual card"
              card={form.content.cards.annual}
              onChange={(patch) => updateCard("annual", patch)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Trust badges</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {form.content.trustBadges.map((badge, i) => (
              <Badge key={`${badge}-${i}`} variant="secondary" className="gap-1 pr-1 font-normal">
                {badge}
                <button
                  type="button"
                  onClick={() => removeBadge(i)}
                  className="ml-0.5 rounded-full hover:bg-black/10 p-0.5"
                  aria-label={`Remove ${badge}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {form.content.trustBadges.length === 0 && (
              <span className="text-sm text-muted-foreground">No trust badges yet.</span>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              value={newBadge}
              onChange={(e) => setNewBadge(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addBadge();
                }
              }}
              placeholder="Secured by Dodo · Cancel in one tap"
            />
            <Button type="button" variant="outline" onClick={addBadge}>
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3 pb-6">
        <div className="flex flex-col gap-1">
          <Button
            variant="outline"
            onClick={handlePreview}
            disabled={isNew || previewing}
            title={isNew ? "Save the variant before previewing" : undefined}
          >
            <ExternalLink className="h-4 w-4" />
            {previewing ? "Building link…" : "Preview"}
          </Button>
          {!isNew && (
            <p className="text-[0.7rem] text-muted-foreground">
              {hasUnsavedChanges
                ? "Shows the last saved version — save first to preview your latest edits."
                : "Opens the live payment page with this variant, in a new tab."}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Link href="/paywall/variants" className="text-sm text-muted-foreground hover:underline self-center">
            Cancel
          </Link>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : isNew ? "Create variant" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CardSlotEditor({
  title,
  card,
  onChange,
}: {
  title: string;
  card: PaywallContent["cards"]["monthly"];
  onChange: (patch: Partial<PaywallContent["cards"]["monthly"]>) => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <p className="text-sm font-medium">{title}</p>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Badge text</Label>
        <Input
          value={card.badgeText ?? ""}
          onChange={(e) => onChange({ badgeText: e.target.value || null })}
          placeholder="Recommended"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          Anchor price — display-only strikethrough (not charged)
        </Label>
        <Input
          value={card.anchorPrice ?? ""}
          onChange={(e) => onChange({ anchorPrice: e.target.value || null })}
          placeholder="$25"
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-input"
          checked={card.recommended}
          onChange={(e) => onChange({ recommended: e.target.checked })}
        />
        Recommended
      </label>
    </div>
  );
}
