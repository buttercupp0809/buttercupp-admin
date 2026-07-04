"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const EVENT_OPTIONS = [
  "Purchase",
  "Lead",
  "InitiateCheckout",
  "AddPaymentInfo",
  "StartTrial",
  "Subscribe",
] as const;

interface TestResult {
  status: number;
  body?: string;
  error?: string;
  requestPayload?: unknown;
}

export default function MetaCapiTestPage() {
  const [eventName, setEventName] = useState<string>("Purchase");
  const [email, setEmail] = useState("");
  const [value, setValue] = useState("39");
  const [currency, setCurrency] = useState("USD");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/meta-capi-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventName,
          email: email.trim() || undefined,
          value: value ? Number(value) : undefined,
          currency: currency.trim() || undefined,
        }),
      });
      const data: TestResult = await res.json();
      setResult(data);
      if (res.ok && data.status === 200) {
        toast.success("Test event fired");
      } else {
        toast.error(data.body || data.error || "Test event failed");
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Request failed";
      setResult({ status: 0, error: message });
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  const ok = result?.status === 200;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Meta CAPI test</h1>
        <p className="text-muted-foreground mt-1">
          Fires a synthetic Meta event with test_event_code attached. Check Meta
          Events Manager &gt; Test Events tab to confirm receipt.
        </p>
      </div>

      <div className="border rounded-lg p-5 space-y-4">
        <div className="space-y-1.5">
          <Label>Event</Label>
          <Select value={eventName} onValueChange={(v) => v && setEventName(v)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVENT_OPTIONS.map((e) => (
                <SelectItem key={e} value={e}>
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email (optional)</Label>
          <Input
            id="email"
            type="email"
            placeholder="test@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="value">Value</Label>
            <Input
              id="value"
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="currency">Currency</Label>
            <Input
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            />
          </div>
        </div>

        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Firing…" : "Fire test event"}
        </Button>
      </div>

      {result && (
        <div
          className={`rounded-lg border p-4 ${
            ok ? "border-green-500" : "border-destructive"
          }`}
        >
          <p className="text-xs text-muted-foreground mb-2">
            Status: <span className="font-mono">{result.status}</span>
          </p>
          <pre className="text-[11px] font-mono whitespace-pre-wrap break-all overflow-x-auto">
            {JSON.stringify(
              { body: result.body, error: result.error, requestPayload: result.requestPayload },
              null,
              2
            )}
          </pre>
        </div>
      )}
    </div>
  );
}
