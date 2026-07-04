"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface Counters {
  attempted: number;
  succeeded: number;
  failed: number;
  missingEventId: number;
  skipped_no_user: number;
}

interface BackfillResult {
  rangeStart: string;
  rangeEnd: string;
  dryRun: boolean;
  counters: Counters;
  errors: { eventId: string; status: number; body: string }[];
  samplePayloads?: unknown[];
}

function toLocalInput(d: Date): string {
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

export default function MetaCapiBackfillPage() {
  const [since, setSince] = useState(() =>
    toLocalInput(new Date(Date.now() - 6 * 60 * 60 * 1000))
  );
  const [limit, setLimit] = useState("500");
  const [dryRun, setDryRun] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BackfillResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const limitNum = Number(limit) || 0;

  async function run() {
    setSubmitting(true);
    setResult(null);
    try {
      const sinceIso = new Date(since).toISOString();
      const qs = new URLSearchParams({
        since: sinceIso,
        dryRun: String(dryRun),
        limit: String(limitNum),
      });
      const res = await fetch(`/api/meta-capi-backfill?${qs}`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
        toast.success(dryRun ? "Dry run complete" : "Backfill complete");
      } else {
        toast.error(data.error || "Backfill failed");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit() {
    if (!dryRun && limitNum > 100) {
      setConfirmOpen(true);
      return;
    }
    run();
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">CAPI backfill</h1>
        <p className="text-muted-foreground mt-1">
          Re-fires CAPI for purchase events in a time window. Idempotent via Meta
          event_id dedup. Use this after a CAPI outage to recover signal.
        </p>
      </div>

      <div className="border rounded-lg p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="since">Since</Label>
            <Input
              id="since"
              type="datetime-local"
              value={since}
              onChange={(e) => setSince(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="limit">Limit</Label>
            <Input
              id="limit"
              type="number"
              min={1}
              max={1000}
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
            className="h-4 w-4 rounded border-input"
          />
          Dry run (don&apos;t actually call Meta)
        </label>

        <Button
          onClick={handleSubmit}
          disabled={submitting}
          variant={dryRun ? "default" : "destructive"}
        >
          {submitting ? "Running…" : "Run backfill"}
        </Button>
      </div>

      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <CounterCard title="Attempted" value={result.counters.attempted} />
            <CounterCard title="Succeeded" value={result.counters.succeeded} />
            <CounterCard title="Failed" value={result.counters.failed} />
            <CounterCard
              title="Missing Event ID"
              value={result.counters.missingEventId}
            />
          </div>

          {result.counters.skipped_no_user > 0 && (
            <p className="text-xs text-muted-foreground">
              Skipped (no user): {result.counters.skipped_no_user}
            </p>
          )}

          {result.dryRun && result.samplePayloads && (
            <div className="border rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-2">
                Sample payloads (first 3)
              </p>
              <pre className="text-[11px] font-mono whitespace-pre-wrap break-all overflow-x-auto">
                {JSON.stringify(result.samplePayloads, null, 2)}
              </pre>
            </div>
          )}

          {result.errors.length > 0 && (
            <div className="border border-destructive rounded-lg p-4 space-y-2">
              <p className="text-xs font-medium text-destructive">Errors</p>
              {result.errors.map((err, i) => (
                <div key={i} className="text-[11px] font-mono">
                  <span className="text-muted-foreground">{err.eventId}</span> [
                  {err.status}] {err.body.slice(0, 200)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm live backfill</DialogTitle>
            <DialogDescription>
              This will fire up to {limitNum} real Purchase events to Meta. Events
              are deduped by event_id, but confirm you want to proceed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmOpen(false);
                run();
              }}
            >
              Run live backfill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CounterCard({ title, value }: { title: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value.toLocaleString()}</div>
      </CardContent>
    </Card>
  );
}
