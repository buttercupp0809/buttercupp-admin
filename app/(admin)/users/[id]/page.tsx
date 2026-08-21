"use client";

import { Fragment, useEffect, useState } from "react";
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
import { ArrowLeft, Mail, Trash2, Coins, ChevronRight, Sparkles, MessageSquarePlus } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UserDetail = any;

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<UserDetail>(null);
  const [loading, setLoading] = useState(true);

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Issue token grant dialog
  const [tokenOpen, setTokenOpen] = useState(false);
  const [tokenAmount, setTokenAmount] = useState("");
  const [tokenNote, setTokenNote] = useState("");
  const [issuingTokens, setIssuingTokens] = useState(false);

  // Activate trial dialog
  const [trialOpen, setTrialOpen] = useState(false);
  const [trialTier, setTrialTier] = useState<"premium" | "pro">("premium");
  const [trialDays, setTrialDays] = useState("30");
  const [activatingTrial, setActivatingTrial] = useState(false);

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

  async function handleIssueTokens() {
    const amount = parseInt(tokenAmount, 10);
    if (!amount || amount <= 0) {
      toast.error("Enter a valid positive number of tokens");
      return;
    }
    setIssuingTokens(true);
    try {
      const res = await fetch(`/api/users/${id}/issue-tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, note: tokenNote || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to issue tokens");
        return;
      }
      toast.success(`Granted ${amount} tokens. New balance: ${data.newBalance}`);
      setUser((prev: UserDetail) =>
        prev ? { ...prev, tokenBalance: data.newBalance } : prev
      );
      setTokenOpen(false);
      setTokenAmount("");
      setTokenNote("");
    } catch {
      toast.error("Failed to issue tokens");
    } finally {
      setIssuingTokens(false);
    }
  }

  async function handleActivateTrial() {
    const days = parseInt(trialDays, 10);
    if (!days || days < 1 || days > 365) {
      toast.error("Days must be between 1 and 365");
      return;
    }
    setActivatingTrial(true);
    try {
      const res = await fetch(`/api/users/${id}/activate-trial`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days, tier: trialTier }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to activate trial");
        return;
      }
      toast.success(`${trialTier} trial activated for ${days} days`);
      setUser((prev: UserDetail) => {
        if (!prev) return prev;
        const updatedSub = prev.subscription
          ? {
              ...prev.subscription,
              tier: data.subscriptionTier,
              plan: "trial",
              status: "active",
              currentPeriodEnd: data.currentPeriodEnd,
            }
          : {
              provider: "admin_trial",
              tier: data.subscriptionTier,
              plan: "trial",
              status: "active",
              currentPeriodEnd: data.currentPeriodEnd,
            };
        return {
          ...prev,
          subscriptionTier: data.subscriptionTier,
          subscription: updatedSub,
        };
      });
      setTrialOpen(false);
    } catch {
      toast.error("Failed to activate trial");
    } finally {
      setActivatingTrial(false);
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Loading user...</div>;
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
            <CardTitle className="text-xl">
              {user.profile?.displayName ?? user.email}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <p className="text-xs text-muted-foreground">ID: {user.id}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline">{user.subscriptionTier}</Badge>
            <Badge variant="secondary">{user.ageVerificationLevel}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 text-sm mb-4">
            <span>Token Balance: <strong>{user.tokenBalance ?? 0}</strong></span>
            <span>Created: {formatDate(user.createdAt)}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => router.push(`/email?to=${user.email}`)}>
              <Mail className="h-4 w-4 mr-1" /> Send Email
            </Button>
            <Button size="sm" variant="outline" onClick={() => setTokenOpen(true)}>
              <Coins className="h-4 w-4 mr-1" /> Issue Token Grant
            </Button>
            <Button size="sm" variant="outline" onClick={() => setTrialOpen(true)}>
              <Sparkles className="h-4 w-4 mr-1" /> Activate Trial
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
          <TabsTrigger value="conversations">Conversations</TabsTrigger>
          <TabsTrigger value="memories">Memories</TabsTrigger>
          <TabsTrigger value="subscription">Subscription + Tokens</TabsTrigger>
          <TabsTrigger value="crisis">Crisis Events</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <ProfileTab user={user} userId={id} onUserUpdate={(patch) => setUser((prev: UserDetail) => prev ? { ...prev, ...patch } : prev)} />
        </TabsContent>
        <TabsContent value="conversations" className="mt-4">
          <ConversationsTab conversations={user.conversations} userId={id} router={router} />
        </TabsContent>
        <TabsContent value="memories" className="mt-4">
          <MemoriesTab memories={user.memories} />
        </TabsContent>
        <TabsContent value="subscription" className="mt-4">
          <SubscriptionTab
            subscription={user.subscription}
            tokenLedger={user.tokenLedger}
            usageCounters={user.usageCounters}
          />
        </TabsContent>
        <TabsContent value="crisis" className="mt-4">
          <CrisisEventsTab crisisEvents={user.crisisEvents} />
        </TabsContent>
      </Tabs>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User Permanently</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete <strong>{user.email}</strong> and all their data
            (conversations, memories, tokens, etc). This cannot be undone.
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
              {deleting ? "Deleting..." : "Delete Permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Issue Token Grant Dialog */}
      <Dialog open={tokenOpen} onOpenChange={setTokenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue Token Grant</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              Grant tokens to <strong>{user.email}</strong>. Current balance: <strong>{user.tokenBalance ?? 0}</strong>.
            </p>
            <div className="space-y-2">
              <p className="text-sm font-medium">Number of tokens:</p>
              <Input
                type="number"
                min={1}
                value={tokenAmount}
                onChange={(e) => setTokenAmount(e.target.value)}
                placeholder="e.g. 100"
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Note / reason (optional):</p>
              <Input
                value={tokenNote}
                onChange={(e) => setTokenNote(e.target.value)}
                placeholder="e.g. compensation for outage"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTokenOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={issuingTokens || !tokenAmount || parseInt(tokenAmount, 10) <= 0}
              onClick={handleIssueTokens}
            >
              {issuingTokens ? "Issuing..." : "Issue Tokens"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Activate Trial Dialog */}
      <Dialog open={trialOpen} onOpenChange={setTrialOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Activate Premium Trial</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              Activate a trial subscription for <strong>{user.email}</strong>.
            </p>
            <div className="space-y-2">
              <p className="text-sm font-medium">Tier:</p>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={trialTier}
                onChange={(e) => setTrialTier(e.target.value as "premium" | "pro")}
              >
                <option value="premium">Premium</option>
                <option value="pro">Pro</option>
              </select>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Days:</p>
              <Input
                type="number"
                min={1}
                max={365}
                value={trialDays}
                onChange={(e) => setTrialDays(e.target.value)}
                placeholder="30"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTrialOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={activatingTrial || !trialDays || parseInt(trialDays, 10) < 1}
              onClick={handleActivateTrial}
            >
              {activatingTrial ? "Activating..." : "Activate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProfileTab({
  user,
  userId,
  onUserUpdate,
}: {
  user: UserDetail;
  userId: string;
  onUserUpdate: (patch: Partial<UserDetail>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [tier, setTier] = useState<string>(user.subscriptionTier);
  const [freeMessages, setFreeMessages] = useState<string>(String(user.freeMessagesUsed ?? 0));
  const [saving, setSaving] = useState(false);

  function handleEdit() {
    setTier(user.subscriptionTier);
    setFreeMessages(String(user.freeMessagesUsed ?? 0));
    setEditing(true);
  }

  function handleCancel() {
    setEditing(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptionTier: tier,
          freeMessagesUsed: parseInt(freeMessages, 10),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to save changes");
        return;
      }
      onUserUpdate(data);
      toast.success("Profile updated");
      setEditing(false);
    } catch {
      toast.error("Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Account</CardTitle>
          {!editing ? (
            <Button size="sm" variant="outline" onClick={handleEdit}>Edit</Button>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleCancel} disabled={saving}>Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Email" value={user.email} />
          <Row label="Date of Birth" value={user.dob ? formatDate(user.dob) : null} />
          <Row label="Jurisdiction" value={user.jurisdiction} />
          <Row label="OAuth Provider" value={user.oauthProvider} />
          {editing ? (
            <>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Subscription Tier</span>
                <select
                  className="border rounded px-2 py-1 text-sm bg-background"
                  value={tier}
                  onChange={(e) => setTier(e.target.value)}
                >
                  <option value="free">free</option>
                  <option value="premium">premium</option>
                  <option value="pro">pro</option>
                </select>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Free Messages Used</span>
                <input
                  type="number"
                  min={0}
                  value={freeMessages}
                  onChange={(e) => setFreeMessages(e.target.value)}
                  className="border rounded px-2 py-1 text-sm w-24 text-right bg-background"
                />
              </div>
            </>
          ) : (
            <>
              <Row label="Subscription Tier" value={user.subscriptionTier} />
              <Row label="Free Messages Used" value={user.freeMessagesUsed} />
            </>
          )}
          <Row label="Token Balance" value={user.tokenBalance} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">Profile</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Display Name" value={user.profile?.displayName} />
          <Row label="Gender" value={user.profile?.gender} />
          {user.profile?.preferences && (
            <div>
              <p className="text-muted-foreground mb-1">Preferences</p>
              <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40 whitespace-pre-wrap">
                {JSON.stringify(user.profile.preferences, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">Verification and Consent</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Age Verification Level" value={user.ageVerificationLevel} />
          <Row label="Age Verified At" value={user.ageVerifiedAt ? formatDateTime(user.ageVerifiedAt) : null} />
          <Row label="Email Verified At" value={user.emailVerifiedAt ? formatDateTime(user.emailVerifiedAt) : null} />
          <Row label="ToS Accepted At" value={user.tosAcceptedAt ? formatDateTime(user.tosAcceptedAt) : null} />
          <Row label="Privacy Accepted At" value={user.privacyAcceptedAt ? formatDateTime(user.privacyAcceptedAt) : null} />
          <Row label="Consent Accepted At" value={user.consentAcceptedAt ? formatDateTime(user.consentAcceptedAt) : null} />
          <Row label="Policy Version" value={user.acceptedPolicyVersion} />
          <Row label="Onboarding Complete" value={user.completedOnboardingAt ? formatDateTime(user.completedOnboardingAt) : null} />
          <Row label="Created At" value={formatDateTime(user.createdAt)} />
        </CardContent>
      </Card>
    </div>
  );
}

function ConversationsTab({
  conversations,
  userId,
  router,
}: {
  conversations: UserDetail[];
  userId: string;
  router: ReturnType<typeof useRouter>;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sendMsgConv, setSendMsgConv] = useState<UserDetail | null>(null);
  const [msgContent, setMsgContent] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const [newMessages, setNewMessages] = useState<Record<string, ChatMessage[]>>({});

  async function handleSendMessage() {
    if (!sendMsgConv || !msgContent.trim()) return;
    setSendingMsg(true);
    try {
      const res = await fetch(`/api/users/${userId}/send-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: sendMsgConv.id, content: msgContent.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to send message");
        return;
      }
      toast.success("Message sent");
      setNewMessages((prev) => ({
        ...prev,
        [sendMsgConv.id]: [...(prev[sendMsgConv.id] ?? []), data.message],
      }));
      setMsgContent("");
      setSendMsgConv(null);
    } catch {
      toast.error("Failed to send message");
    } finally {
      setSendingMsg(false);
    }
  }

  if (!conversations?.length) return <Empty label="No conversations" />;
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Character Name</TableHead>
            <TableHead>Style</TableHead>
            <TableHead>Content Rating</TableHead>
            <TableHead>Moderation Status</TableHead>
            <TableHead>Message Count</TableHead>
            <TableHead>Last Message At</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {conversations.map((c: UserDetail) => {
            const isOpen = expandedId === c.id;
            return (
              <Fragment key={c.id}>
                <TableRow
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setExpandedId(isOpen ? null : c.id)}
                >
                  <TableCell className="text-muted-foreground">
                    <ChevronRight
                      className={`h-4 w-4 transition-transform ${isOpen ? "rotate-90" : ""}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{c.character?.name ?? c.characterId}</TableCell>
                  <TableCell><Badge variant="outline">{c.character?.style ?? "—"}</Badge></TableCell>
                  <TableCell>{c.character?.contentRating ?? "—"}</TableCell>
                  <TableCell>{c.character?.moderationStatus ?? "—"}</TableCell>
                  <TableCell>{c.messageCount}</TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {c.lastMessageAt ? formatDateTime(c.lastMessageAt) : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/characters/${c.character?.id ?? c.characterId}`);
                        }}
                      >
                        View character
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSendMsgConv(c);
                          setMsgContent("");
                        }}
                      >
                        <MessageSquarePlus className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                {isOpen && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={8} className="bg-muted/30 p-0">
                      <ConversationMessages
                        conversationId={c.id}
                        characterName={c.character?.name ?? c.characterId}
                        injectedMessages={newMessages[c.id] ?? []}
                      />
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>

      <Dialog open={!!sendMsgConv} onOpenChange={(open) => { if (!open) setSendMsgConv(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Send message as {sendMsgConv?.character?.name ?? sendMsgConv?.characterId}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            <textarea
              placeholder="Message content..."
              value={msgContent}
              onChange={(e) => setMsgContent(e.target.value)}
              rows={5}
              className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendMsgConv(null)}>Cancel</Button>
            <Button
              disabled={sendingMsg || !msgContent.trim()}
              onClick={handleSendMessage}
            >
              {sendingMsg ? "Sending..." : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface ChatMessage {
  id: string;
  role: string;
  content: string;
  mediaAssetId: string | null;
  tokenCost: number | null;
  createdAt: string;
}

function ConversationMessages({
  conversationId,
  characterName,
  injectedMessages,
}: {
  conversationId: string;
  characterName: string;
  injectedMessages: ChatMessage[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/conversations/${conversationId}/messages?page=${page}`);
        const data = await res.json();
        if (cancelled) return;
        setMessages((prev) => (page === 1 ? data.messages : [...prev, ...data.messages]));
        setTotal(data.total ?? 0);
        setHasMore(Boolean(data.hasMore));
      } catch {
        if (!cancelled) toast.error("Failed to load messages");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId, page]);

  const allMessages = [...messages, ...injectedMessages];

  if (loading && messages.length === 0) {
    return <div className="py-6 text-center text-sm text-muted-foreground">Loading messages...</div>;
  }
  if (!loading && total === 0 && injectedMessages.length === 0) {
    return <div className="py-6 text-center text-sm text-muted-foreground">No messages in this conversation</div>;
  }

  return (
    <div className="p-4 space-y-3 max-h-[28rem] overflow-y-auto">
      <p className="text-xs text-muted-foreground">
        {total} message{total === 1 ? "" : "s"} with {characterName}
      </p>
      {allMessages.map((m) => {
        const isUser = m.role === "user";
        return (
          <div key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                isUser ? "bg-primary text-primary-foreground" : "bg-background border"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Badge variant={isUser ? "secondary" : "outline"} className="text-[10px] capitalize">
                  {m.role}
                </Badge>
                <span className={`text-[10px] ${isUser ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {formatDateTime(m.createdAt)}
                </span>
              </div>
              <p className="whitespace-pre-wrap break-words">{m.content}</p>
              {m.mediaAssetId && (
                <p className={`mt-1 text-[10px] ${isUser ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  [media attached: {m.mediaAssetId}]
                </p>
              )}
            </div>
          </div>
        );
      })}
      {hasMore && (
        <div className="text-center pt-2">
          <Button variant="outline" size="sm" disabled={loading} onClick={() => setPage((p) => p + 1)}>
            {loading ? "Loading..." : "Load older messages"}
          </Button>
        </div>
      )}
    </div>
  );
}

function MemoriesTab({ memories }: { memories: UserDetail[] }) {
  if (!memories?.length) return <Empty label="No memories" />;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Category</TableHead>
          <TableHead>Tier</TableHead>
          <TableHead>Importance</TableHead>
          <TableHead>Pinned</TableHead>
          <TableHead className="max-w-md">Content</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {memories.map((m: UserDetail) => (
          <TableRow key={m.id}>
            <TableCell><Badge variant="outline">{m.category}</Badge></TableCell>
            <TableCell><Badge variant="secondary">{m.tier}</Badge></TableCell>
            <TableCell>{m.importance ?? "—"}</TableCell>
            <TableCell>{m.pinned ? "Yes" : "—"}</TableCell>
            <TableCell className="max-w-md truncate">{m.content}</TableCell>
            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
              {formatDate(m.createdAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function SubscriptionTab({
  subscription,
  tokenLedger,
  usageCounters,
}: {
  subscription: UserDetail;
  tokenLedger: UserDetail[];
  usageCounters: UserDetail[];
}) {
  return (
    <div className="space-y-6">
      {subscription ? (
        <Card>
          <CardHeader><CardTitle className="text-sm">Subscription</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Provider" value={subscription.provider} />
            <Row label="Tier" value={subscription.tier} />
            <Row label="Plan" value={subscription.plan} />
            <Row label="Status" value={subscription.status} />
            <Row
              label="Current Period End"
              value={subscription.currentPeriodEnd ? formatDateTime(subscription.currentPeriodEnd) : null}
            />
            <Row label="External ID" value={subscription.externalId} />
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">No subscription record found.</p>
      )}

      <div>
        <h3 className="font-medium mb-2">Token Ledger ({tokenLedger?.length || 0})</h3>
        {tokenLedger?.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Delta</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Balance After</TableHead>
                <TableHead>Ref ID</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokenLedger.map((entry: UserDetail) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <span className={entry.delta >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                      {entry.delta >= 0 ? "+" : ""}{entry.delta}
                    </span>
                  </TableCell>
                  <TableCell><Badge variant="outline">{entry.reason}</Badge></TableCell>
                  <TableCell>{entry.balanceAfter}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{entry.refId ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {formatDateTime(entry.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : <Empty label="No token ledger entries" />}
      </div>

      <div>
        <h3 className="font-medium mb-2">Usage Counters ({usageCounters?.length || 0})</h3>
        {usageCounters?.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Counter Type</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usageCounters.map((u: UserDetail) => (
                <TableRow key={u.id}>
                  <TableCell>{u.counterType}</TableCell>
                  <TableCell>{u.period}</TableCell>
                  <TableCell>{u.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : <Empty label="No usage data" />}
      </div>
    </div>
  );
}

function CrisisEventsTab({ crisisEvents }: { crisisEvents: UserDetail[] }) {
  if (!crisisEvents?.length) return <Empty label="No crisis events" />;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Level</TableHead>
          <TableHead>Trigger</TableHead>
          <TableHead>Action</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {crisisEvents.map((c: UserDetail) => (
          <TableRow key={c.id}>
            <TableCell><Badge variant="destructive">Level {c.level}</Badge></TableCell>
            <TableCell className="max-w-xs truncate">{c.trigger ?? "—"}</TableCell>
            <TableCell>{c.action ?? "—"}</TableCell>
            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
              {formatDateTime(c.createdAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
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
