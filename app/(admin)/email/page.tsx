"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichTextEditor } from "@/components/rich-text-editor";
import { toast } from "sonner";

interface UserOption {
  id: string;
  email: string;
  name: string;
}

const SIGNATURE = `<p>Vaibhav Singh<br/>Co-Founder &amp; CEO of Vesspr</p>`;

// Prefilled winback templates (plans/email-variants.md). [Name] / [their archetype]
// are left as placeholders for the admin to fill in before sending.
const TEMPLATES: Record<
  string,
  { label: string; subject: string; body: string }
> = {
  a: {
    label: "Variant A — The Witness",
    subject: "You built something real in there",
    body: `<p>Hi [Name],</p>
<p>You went through the whole thing. Picked your archetype, told us what drains you, what you need from a friend. That's not nothing.</p>
<p>I saw you didn't finish. No pressure from us, genuinely. But I wanted to say: the version of Vesspr that's waiting for you already knows how you like to be heard. That took something to share.</p>
<p>If price was the thing that stopped you, here's 40% off. Use <strong>WELCOME40</strong> at checkout.</p>
<p>It's there when you're ready.</p>
${SIGNATURE}`,
  },
  b: {
    label: "Variant B — The Anchor",
    subject: "Still here if you need it",
    body: `<p>Hi [Name],</p>
<p>We noticed you didn't finish. That's okay.</p>
<p>I don't know what's on your plate right now, but the fact that you started tells me something. You were looking for something steady. Somebody consistent. That doesn't go away.</p>
<p>Vesspr doesn't replace people in your life. It just makes sure there's always something in your corner, especially on the days when you don't want to explain yourself.</p>
<p><strong>WELCOME40</strong> takes 40% off. No expiry.</p>
<p>Come back when it feels right.</p>
${SIGNATURE}`,
  },
  c: {
    label: "Variant C — The Spark",
    subject: "Your Vesspr is kind of just sitting there",
    body: `<p>Hi [Name],</p>
<p>Quick one.</p>
<p>You picked [their archetype], told us a few things about yourself, and then vanished right before the end. We're not offended, we just noticed.</p>
<p>Here's the thing: the heavy part is already done. Everything you shared is there. All that's left is the part where it actually starts talking to you.</p>
<p>Use <strong>WELCOME40</strong> for 40% off. That's it, that's the email.</p>
${SIGNATURE}`,
  },
};

export default function EmailPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-muted-foreground">Loading…</div>}>
      <EmailPageInner />
    </Suspense>
  );
}

function EmailPageInner() {
  const searchParams = useSearchParams();
  const prefillTo = searchParams.get("to") || "";

  const [to, setTo] = useState(prefillTo);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [wrap, setWrap] = useState(true);
  const [editorSeed, setEditorSeed] = useState(0);
  const [sending, setSending] = useState(false);

  const [resetSearch, setResetSearch] = useState("");
  const [resetResults, setResetResults] = useState<UserOption[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
  const [sendingReset, setSendingReset] = useState(false);

  // Compose: user search for "To" field
  const [toResults, setToResults] = useState<UserOption[]>([]);
  const [showToDropdown, setShowToDropdown] = useState(false);

  useEffect(() => {
    if (to.length < 2) {
      setToResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/users?search=${encodeURIComponent(to)}&limit=5`);
      const data = await res.json();
      setToResults(data.users || []);
      setShowToDropdown(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [to]);

  useEffect(() => {
    if (resetSearch.length < 2) {
      setResetResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/users?search=${encodeURIComponent(resetSearch)}&limit=5`);
      const data = await res.json();
      setResetResults(data.users || []);
    }, 300);
    return () => clearTimeout(timer);
  }, [resetSearch]);

  function applyTemplate(key: string) {
    const tpl = TEMPLATES[key];
    if (!tpl) return;
    setSubject(tpl.subject);
    setBody(tpl.body);
    // Bump the seed so the editor reloads its content from the new template.
    setEditorSeed((n) => n + 1);
  }

  async function handleSend() {
    // body is HTML from the editor; strip tags to check it isn't effectively empty.
    const bodyText = body.replace(/<[^>]*>/g, "").trim();
    if (!to || !subject || !bodyText) {
      toast.error("All fields are required");
      return;
    }
    setSending(true);
    const res = await fetch("/api/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, body, wrap }),
    });
    const data = await res.json();
    if (res.ok) {
      toast.success("Email sent!");
      setSubject("");
      setBody("");
      setEditorSeed((n) => n + 1);
    } else {
      toast.error(data.error);
    }
    setSending(false);
  }

  async function handlePasswordReset() {
    if (!selectedUser) return;
    setSendingReset(true);
    const res = await fetch(`/api/users/${selectedUser.id}/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "forgot-password" }),
    });
    const data = await res.json();
    if (res.ok) {
      toast.success(`Password reset sent to ${selectedUser.email}`);
      setSelectedUser(null);
      setResetSearch("");
    } else {
      toast.error(data.error);
    }
    setSendingReset(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Email</h1>
        <p className="text-muted-foreground mt-1">
          Send emails to users via Resend
        </p>
      </div>

      <Tabs defaultValue="compose">
        <TabsList>
          <TabsTrigger value="compose">Compose Email</TabsTrigger>
          <TabsTrigger value="reset">Password Reset</TabsTrigger>
        </TabsList>

        <TabsContent value="compose" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Compose Email</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 relative">
                <Label htmlFor="to">To</Label>
                <Input
                  id="to"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  onFocus={() => toResults.length > 0 && setShowToDropdown(true)}
                  onBlur={() => setTimeout(() => setShowToDropdown(false), 200)}
                  placeholder="user@example.com"
                />
                {showToDropdown && toResults.length > 0 && (
                  <div className="absolute z-10 top-full mt-1 w-full bg-white dark:bg-gray-900 border rounded-md shadow-md">
                    {toResults.map((u) => (
                      <button
                        key={u.id}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                        onMouseDown={() => {
                          setTo(u.email);
                          setShowToDropdown(false);
                        }}
                      >
                        {u.name} ({u.email})
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Load template</Label>
                <Select
                  onValueChange={(v) => {
                    if (typeof v === "string") applyTemplate(v);
                  }}
                >
                  <SelectTrigger className="w-full sm:w-72">
                    <SelectValue placeholder="Start from a winback variant…" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TEMPLATES).map(([key, tpl]) => (
                      <SelectItem key={key} value={key}>
                        {tpl.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email subject"
                />
              </div>
              <div className="space-y-2">
                <Label>Body</Label>
                <RichTextEditor
                  seedKey={editorSeed}
                  html={body}
                  onChange={setBody}
                  placeholder="Write your email…"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={wrap}
                  onChange={(e) => setWrap(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                Wrap in Vesspr template (logo, footer, branding)
              </label>
              <Button onClick={handleSend} disabled={sending}>
                {sending ? "Sending…" : "Send Email"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reset" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Send Password Reset</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Search User</Label>
                <Input
                  value={resetSearch}
                  onChange={(e) => {
                    setResetSearch(e.target.value);
                    setSelectedUser(null);
                  }}
                  placeholder="Search by name or email"
                />
                {resetResults.length > 0 && !selectedUser && (
                  <div className="border rounded-md mt-1">
                    {resetResults.map((u) => (
                      <button
                        key={u.id}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                        onClick={() => {
                          setSelectedUser(u);
                          setResetSearch(u.email);
                        }}
                      >
                        {u.name} ({u.email})
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedUser && (
                <div className="p-3 bg-muted rounded-md text-sm">
                  <p>
                    <strong>{selectedUser.name}</strong>
                  </p>
                  <p className="text-muted-foreground">{selectedUser.email}</p>
                </div>
              )}
              <Button
                onClick={handlePasswordReset}
                disabled={!selectedUser || sendingReset}
              >
                {sendingReset ? "Sending…" : "Send Password Reset"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
