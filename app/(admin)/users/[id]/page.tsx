"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft, Mail, KeyRound, Trash2, MessageCircle, Send, Cake } from "lucide-react";
import { formatDate, formatDateTime, formatCountry } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UserDetail = any;

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<UserDetail>(null);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [shiftConfirmEmail, setShiftConfirmEmail] = useState("");
  const [shiftSendEmail, setShiftSendEmail] = useState(true);
  const [shifting, setShifting] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);
  const [msgMode, setMsgMode] = useState<"raw" | "llm">("llm");
  const [msgText, setMsgText] = useState("");
  const [msgPrompt, setMsgPrompt] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const [birthdayOpen, setBirthdayOpen] = useState(false);
  const [birthdayForce, setBirthdayForce] = useState(false);
  const [sendingBirthday, setSendingBirthday] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/users/${id}`);
        const text = await res.text();
        const data = text ? JSON.parse(text) : null;
        if (cancelled) return;
        if (!res.ok || !data) {
          toast.error(data?.error || `Failed to load user (${res.status})`);
          router.push("/users");
          return;
        }
        setUser(data);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load user", err);
        toast.error("Failed to load user");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/users/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmEmail }),
    });
    const data = await res.json();
    if (res.ok) {
      toast.success(`Deleted user ${data.deleted}`);
      router.push("/users");
    } else {
      toast.error(data.error);
    }
    setDeleting(false);
  }

  async function handleSendMessage() {
    if (msgMode === "raw" && !msgText.trim()) {
      toast.error("Text is empty");
      return;
    }
    if (msgMode === "llm" && !msgPrompt.trim()) {
      toast.error("Prompt is empty");
      return;
    }
    setSendingMsg(true);
    try {
      const res = await fetch(`/api/users/${id}/send-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: msgMode,
          text: msgMode === "raw" ? msgText : undefined,
          prompt: msgMode === "llm" ? msgPrompt : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Send failed");
        return;
      }
      toast.success(`Sent via ${data.platform}: ${data.text.slice(0, 60)}${data.text.length > 60 ? "…" : ""}`);
      setMsgOpen(false);
      setMsgText("");
      setMsgPrompt("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSendingMsg(false);
    }
  }

  async function handleSendBirthday() {
    setSendingBirthday(true);
    try {
      const res = await fetch(`/api/users/${id}/send-birthday`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: birthdayForce }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Birthday send failed");
        return;
      }
      if (!data.sent) {
        toast.info(`Skipped: ${data.reason}`);
      } else {
        toast.success(
          `Birthday sent via ${data.result?.platform}: ${data.result?.text.slice(0, 60)}${data.result?.text.length > 60 ? "…" : ""}`
        );
      }
      setBirthdayOpen(false);
      setBirthdayForce(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Birthday send failed");
    } finally {
      setSendingBirthday(false);
    }
  }

  async function handleShiftToWhatsapp() {
    setShifting(true);
    try {
      const res = await fetch(`/api/users/${id}/shift-to-whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmEmail: shiftConfirmEmail,
          sendEmail: shiftSendEmail,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Shift failed");
        return;
      }
      if (data.alreadyOnWhatsapp) {
        toast.info("Already on WhatsApp, no changes");
      } else if (data.emailSent) {
        toast.success("Shifted to WhatsApp, email sent");
      } else if (data.emailError) {
        toast.warning(`Shifted, but email failed: ${data.emailError}`);
      } else {
        toast.success("Shifted to WhatsApp (no email sent)");
      }
      setShiftOpen(false);
      setShiftConfirmEmail("");
      setUser((prev: UserDetail) =>
        prev ? { ...prev, ...data.user } : prev
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Shift failed");
    } finally {
      setShifting(false);
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Loading user…</div>;
  }

  if (!user) return null;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.push("/users")}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Users
      </Button>

      {/* Header Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl">{user.name}</CardTitle>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline">{user.platform}</Badge>
            <Badge>{user.subscriptionTier}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 text-sm">
            <span>Created: {formatDate(user.createdAt)}</span>
            <span>Timezone: {user.timezone}</span>
            {user.age && <span>Age: {user.age}</span>}
            {user.gender && <span>Gender: {user.gender}</span>}
          </div>
          <div className="flex gap-2 mt-4">
            <Button size="sm" variant="outline" onClick={() => router.push(`/email?to=${user.email}`)}>
              <Mail className="h-4 w-4 mr-1" /> Send Email
            </Button>
            <Button size="sm" variant="outline">
              <KeyRound className="h-4 w-4 mr-1" /> Password Reset
            </Button>
            <Button size="sm" variant="outline" onClick={() => setMsgOpen(true)}>
              <Send className="h-4 w-4 mr-1" /> Send Message
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setBirthdayOpen(true)}
              disabled={!user.dateOfBirth}
              title={
                user.dateOfBirth
                  ? "Send a personalized birthday message crafted from their memories"
                  : "No date of birth on file"
              }
            >
              <Cake className="h-4 w-4 mr-1" /> Send Birthday
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShiftOpen(true)}
              disabled={user.platform === "whatsapp"}
              title={
                user.platform === "whatsapp"
                  ? user.whatsappPhoneId
                    ? "Already on WhatsApp"
                    : "Shifted to WhatsApp, awaiting re-pair"
                  : "Move this user from Telegram to WhatsApp"
              }
            >
              <MessageCircle className="h-4 w-4 mr-1" /> Shift to WhatsApp
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4 mr-1" /> Delete User
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="profile">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="memories">Memories</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="emotional">Emotional</TabsTrigger>
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
          <TabsTrigger value="relationship">Relationship</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4 mt-4">
          <ProfileTab user={user} />
        </TabsContent>
        <TabsContent value="messages" className="mt-4">
          <MessagesTab messages={user.messages} />
        </TabsContent>
        <TabsContent value="memories" className="mt-4">
          <MemoriesTab memories={user.memories} />
        </TabsContent>
        <TabsContent value="events" className="mt-4">
          <EventsTab events={user.events} />
        </TabsContent>
        <TabsContent value="emotional" className="mt-4">
          <EmotionalTab
            patterns={user.emotionalPatterns}
            contexts={user.emotionalContexts}
            crises={user.crisisEvents}
          />
        </TabsContent>
        <TabsContent value="subscription" className="mt-4">
          <SubscriptionTab subscription={user.subscription} usage={user.usageCounters} />
        </TabsContent>
        <TabsContent value="relationship" className="mt-4">
          <RelationshipTab arcs={user.arcs} chunks={user.conversationChunks} />
        </TabsContent>
        <TabsContent value="system" className="mt-4">
          <SystemTab user={user} />
        </TabsContent>
      </Tabs>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User Permanently</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete <strong>{user.name}</strong> and all their data
            (messages, memories, events, etc). This cannot be undone.
          </p>
          <div className="space-y-2 mt-4">
            <p className="text-sm font-medium">
              Type <code className="bg-muted px-1 rounded">{user.email}</code> to confirm:
            </p>
            <Input
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder={user.email}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={confirmEmail !== user.email || deleting}
              onClick={handleDelete}
            >
              {deleting ? "Deleting…" : "Delete Permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Message Dialog */}
      <Dialog open={msgOpen} onOpenChange={setMsgOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send message to {user.name || user.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="msgMode"
                  value="llm"
                  checked={msgMode === "llm"}
                  onChange={() => setMsgMode("llm")}
                />
                LLM prompt (crafted in-persona)
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="msgMode"
                  value="raw"
                  checked={msgMode === "raw"}
                  onChange={() => setMsgMode("raw")}
                />
                Plain text (sent verbatim)
              </label>
            </div>
            {msgMode === "llm" ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Describe the message. Vesspr will write it in her voice, referencing this
                  user&apos;s memories, personality, and arc.
                </p>
                <textarea
                  className="w-full min-h-[120px] border border-input rounded-md bg-background px-3 py-2 text-sm"
                  placeholder='e.g. "wish them luck on their move to Berlin next week"'
                  value={msgPrompt}
                  onChange={(e) => setMsgPrompt(e.target.value)}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Text sent to the user verbatim. Skips the LLM entirely.
                </p>
                <textarea
                  className="w-full min-h-[120px] border border-input rounded-md bg-background px-3 py-2 text-sm"
                  placeholder="Type the exact message"
                  value={msgText}
                  onChange={(e) => setMsgText(e.target.value)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMsgOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                sendingMsg ||
                (msgMode === "raw" ? !msgText.trim() : !msgPrompt.trim())
              }
              onClick={handleSendMessage}
            >
              {sendingMsg ? "Sending…" : "Send Message"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Birthday Dialog */}
      <Dialog open={birthdayOpen} onOpenChange={setBirthdayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send birthday message</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground space-y-2 mt-2">
            <p>
              A personalized birthday message will be crafted by the LLM, referencing this
              user&apos;s memories, personality, and shared history.
            </p>
            <p>
              DOB on file:{" "}
              <strong>
                {user.dateOfBirth ? formatDate(user.dateOfBirth) : "not set"}
              </strong>
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm mt-3">
            <input
              type="checkbox"
              checked={birthdayForce}
              onChange={(e) => setBirthdayForce(e.target.checked)}
              className="h-4 w-4"
            />
            Force send even if one was already sent this year
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBirthdayOpen(false)}>
              Cancel
            </Button>
            <Button disabled={sendingBirthday} onClick={handleSendBirthday}>
              {sendingBirthday ? "Sending…" : "Send Birthday"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shift to WhatsApp Dialog */}
      <Dialog open={shiftOpen} onOpenChange={setShiftOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Shift to WhatsApp</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground space-y-3">
            <p>
              This will move <strong>{user.name || user.email}</strong> from Telegram to
              WhatsApp. Their Telegram binding will be cleared. Their memories,
              personality, and history stay.
            </p>
            <p>
              The user must re-pair on WhatsApp by sending the pre-filled{" "}
              <code className="bg-muted px-1 rounded">hi &lt;userId&gt;</code> message
              to the Vesspr number.
            </p>
          </div>
          <div className="space-y-3 mt-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Type <code className="bg-muted px-1 rounded">{user.email}</code> to
                confirm:
              </p>
              <Input
                value={shiftConfirmEmail}
                onChange={(e) => setShiftConfirmEmail(e.target.value)}
                placeholder={user.email}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={shiftSendEmail}
                onChange={(e) => setShiftSendEmail(e.target.checked)}
                className="h-4 w-4"
              />
              Email the user a wa.me link
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShiftOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={shiftConfirmEmail !== user.email || shifting}
              onClick={handleShiftToWhatsapp}
            >
              {shifting ? "Shifting…" : "Shift to WhatsApp"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProfileTab({ user }: { user: UserDetail }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-sm">User Info</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Nickname" value={user.nickname} />
          <Row label="Country" value={user.country ? `${formatCountry(user.country)} (${user.country})` : null} />
          <Row label="Living Situation" value={user.livingSituation} />
          <Row label="Onboarding Step" value={user.onboardingStep} />
          <Row label="Onboarding Complete" value={user.onboardingComplete ? "Yes" : "No"} />
          <Row label="Memory Paused" value={user.memoryPaused ? "Yes" : "No"} />
          <Row label="Is Paused" value={user.isPaused ? "Yes" : "No"} />
        </CardContent>
      </Card>
      {user.personality && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Personality</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Primary Archetype" value={user.personality.primaryArchetype} />
            <Row label="Secondary Archetype" value={user.personality.secondaryArchetype} />
            <Row label="Tone" value={user.personality.tone} />
            <Row label="Honesty" value={user.personality.honesty} />
            <Row label="Depth" value={user.personality.depth} />
            <Row label="Mirror Ceiling" value={user.personality.mirrorCeiling} />
            <Row label="Initiation Freq" value={user.personality.initiationFrequency} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MessagesTab({ messages }: { messages: UserDetail[] }) {
  if (!messages?.length) return <Empty label="No messages" />;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Sender</TableHead>
          <TableHead>Platform</TableHead>
          <TableHead className="max-w-md">Content</TableHead>
          <TableHead>Sent At</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {messages.map((m: UserDetail) => (
          <TableRow key={m.id}>
            <TableCell>
              <Badge variant={m.sender === "user" ? "default" : "secondary"}>{m.sender}</Badge>
            </TableCell>
            <TableCell><Badge variant="outline">{m.platform}</Badge></TableCell>
            <TableCell className="max-w-md truncate">{m.content}</TableCell>
            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
              {formatDateTime(m.sentAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function MemoriesTab({ memories }: { memories: UserDetail[] }) {
  if (!memories?.length) return <Empty label="No memories" />;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Type</TableHead>
          <TableHead>Importance</TableHead>
          <TableHead className="max-w-md">Content</TableHead>
          <TableHead>Pinned</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {memories.map((m: UserDetail) => (
          <TableRow key={m.id}>
            <TableCell><Badge variant="outline">{m.type}</Badge></TableCell>
            <TableCell><Badge variant={m.importance === "high" ? "destructive" : "secondary"}>{m.importance}</Badge></TableCell>
            <TableCell className="max-w-md truncate">{m.content}</TableCell>
            <TableCell>{m.isPinned ? "📌" : "—"}</TableCell>
            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
              {formatDate(m.createdAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function EventsTab({ events }: { events: UserDetail[] }) {
  if (!events?.length) return <Empty label="No events" />;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Title</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Importance</TableHead>
          <TableHead>Follow-up Sent</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {events.map((e: UserDetail) => (
          <TableRow key={e.id}>
            <TableCell>{e.title}</TableCell>
            <TableCell className="whitespace-nowrap">{formatDate(e.eventDate)}</TableCell>
            <TableCell><Badge variant="outline">{e.importance}</Badge></TableCell>
            <TableCell>{e.followUpSent ? "Yes" : "No"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function EmotionalTab({
  patterns,
  contexts,
  crises,
}: {
  patterns: UserDetail[];
  contexts: UserDetail[];
  crises: UserDetail[];
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-medium mb-2">Emotional Patterns ({patterns?.length || 0})</h3>
        {patterns?.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pattern</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Occurrences</TableHead>
                <TableHead>Last Seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {patterns.map((p: UserDetail) => (
                <TableRow key={p.id}>
                  <TableCell>{p.pattern}</TableCell>
                  <TableCell>{(p.confidence * 100).toFixed(0)}%</TableCell>
                  <TableCell>{p.occurrences}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(p.lastSeen)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : <Empty label="No patterns" />}
      </div>
      <div>
        <h3 className="font-medium mb-2">Emotional Contexts ({contexts?.length || 0})</h3>
        {contexts?.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Phase</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contexts.map((c: UserDetail) => (
                <TableRow key={c.id}>
                  <TableCell>{c.category}</TableCell>
                  <TableCell><Badge variant="outline">{c.severity}</Badge></TableCell>
                  <TableCell>{c.phase}</TableCell>
                  <TableCell className="max-w-xs truncate">{c.trigger}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(c.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : <Empty label="No contexts" />}
      </div>
      <div>
        <h3 className="font-medium mb-2">Crisis Events ({crises?.length || 0})</h3>
        {crises?.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Level</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Action Taken</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {crises.map((c: UserDetail) => (
                <TableRow key={c.id}>
                  <TableCell><Badge variant="destructive">Level {c.level}</Badge></TableCell>
                  <TableCell className="max-w-xs truncate">{c.messageContent}</TableCell>
                  <TableCell>{c.actionTaken}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(c.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : <Empty label="No crisis events" />}
      </div>
    </div>
  );
}

function SubscriptionTab({ subscription, usage }: { subscription: UserDetail; usage: UserDetail[] }) {
  return (
    <div className="space-y-6">
      {subscription && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Subscription</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Tier" value={subscription.tier} />
            <Row label="Status" value={subscription.status} />
            <Row label="Billing" value={subscription.billingInterval} />
            <Row label="Started" value={subscription.startedAt ? formatDate(subscription.startedAt) : "N/A"} />
            <Row label="Next Billing" value={subscription.nextBillingAt ? formatDate(subscription.nextBillingAt) : "N/A"} />
          </CardContent>
        </Card>
      )}
      <div>
        <h3 className="font-medium mb-2">Usage Counters</h3>
        {usage?.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>LLM</TableHead>
                <TableHead>Voice</TableHead>
                <TableHead>Images</TableHead>
                <TableHead>AI Initiated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usage.map((u: UserDetail) => (
                <TableRow key={u.id}>
                  <TableCell>{u.period}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(u.periodStart)}</TableCell>
                  <TableCell>{u.llmMessages}</TableCell>
                  <TableCell>{u.voiceNotes}</TableCell>
                  <TableCell>{u.imageGens}</TableCell>
                  <TableCell>{u.aiInitiated}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : <Empty label="No usage data" />}
      </div>
    </div>
  );
}

function RelationshipTab({ arcs, chunks }: { arcs: UserDetail[]; chunks: UserDetail[] }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-medium mb-2">Relationship Arcs</h3>
        {arcs?.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Week</TableHead>
                <TableHead>Themes</TableHead>
                <TableHead>Tone</TableHead>
                <TableHead>Messages</TableHead>
                <TableHead>Response Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {arcs.map((a: UserDetail) => (
                <TableRow key={a.id}>
                  <TableCell>Week {a.weekNumber}</TableCell>
                  <TableCell className="max-w-xs">{a.themes?.join(", ")}</TableCell>
                  <TableCell>{a.emotionalToneAvg}</TableCell>
                  <TableCell>{a.totalMessagesSent}</TableCell>
                  <TableCell>{(a.responseRate * 100).toFixed(0)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : <Empty label="No arcs" />}
      </div>
      <div>
        <h3 className="font-medium mb-2">Conversation Chunks</h3>
        {chunks?.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Topic</TableHead>
                <TableHead className="max-w-md">Content</TableHead>
                <TableHead>Archived</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {chunks.map((c: UserDetail) => (
                <TableRow key={c.id}>
                  <TableCell>{c.topic || "—"}</TableCell>
                  <TableCell className="max-w-md truncate">{c.content}</TableCell>
                  <TableCell>{c.isArchived ? "Yes" : "No"}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(c.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : <Empty label="No chunks" />}
      </div>
    </div>
  );
}

function SystemTab({ user }: { user: UserDetail }) {
  return (
    <div className="space-y-6">
      {user.boundary && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Boundary Settings</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="DND" value={`${user.boundary.dndStart} – ${user.boundary.dndEnd}`} />
            <Row label="Max Daily AI Msgs" value={user.boundary.maxDailyAiMessages} />
            <Row label="Ping Cadence" value={user.boundary.pingCadence} />
            <Row label="Voice Enabled" value={user.boundary.voiceNotesEnabled ? "Yes" : "No"} />
            <Row label="Follow-up Enabled" value={user.boundary.followUpEnabled ? "Yes" : "No"} />
          </CardContent>
        </Card>
      )}
      <div>
        <h3 className="font-medium mb-2">Scheduled Pings ({user.scheduledPings?.length || 0})</h3>
        {user.scheduledPings?.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reason</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {user.scheduledPings.map((p: UserDetail) => (
                <TableRow key={p.id}>
                  <TableCell>{p.reason}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDateTime(p.scheduledAt)}</TableCell>
                  <TableCell><Badge variant="outline">{p.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : <Empty label="No pings" />}
      </div>
      {user.persona && (
        <Card>
          <CardHeader><CardTitle className="text-sm">User Persona</CardTitle></CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-64 whitespace-pre-wrap">
              {user.persona.persona}
            </pre>
          </CardContent>
        </Card>
      )}
      <div>
        <h3 className="font-medium mb-2">Memory Summaries ({user.memorySummaries?.length || 0})</h3>
        {user.memorySummaries?.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Sentiment</TableHead>
                <TableHead>Themes</TableHead>
                <TableHead>Summary</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {user.memorySummaries.map((s: UserDetail) => (
                <TableRow key={s.id}>
                  <TableCell>{s.period}</TableCell>
                  <TableCell>{s.sentiment}</TableCell>
                  <TableCell className="max-w-xs">{s.themes?.join(", ")}</TableCell>
                  <TableCell className="max-w-md truncate">{s.summary}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : <Empty label="No summaries" />}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value ?? "—"}</span>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="text-center py-8 text-muted-foreground">{label}</p>;
}
