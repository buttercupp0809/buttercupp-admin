"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface UserOption {
  id: string;
  email: string;
  name: string;
}

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

  async function handleSend() {
    if (!to || !subject || !body) {
      toast.error("All fields are required");
      return;
    }
    setSending(true);
    const res = await fetch("/api/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, body }),
    });
    const data = await res.json();
    if (res.ok) {
      toast.success("Email sent!");
      setSubject("");
      setBody("");
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
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email subject"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="body">Body</Label>
                <textarea
                  id="body"
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[150px] resize-y"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Email body (plain text, newlines preserved)"
                />
              </div>
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
