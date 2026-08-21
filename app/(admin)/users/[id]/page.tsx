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
import { ArrowLeft, Mail, Trash2, Coins, ChevronRight } from "lucide-react";
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
            <CardTitle className="text-xl">{user.email}</CardTitle>
            <p className="text-sm text-muted-foreground">ID: {user.id}</p>
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
          <ProfileTab user={user} />
        </TabsContent>
        <TabsContent value="conversations" className="mt-4">
          <ConversationsTab conversations={user.conversations} router={router} />
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
    </div>
  );
}

function ProfileTab({ user }: { user: UserDetail }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-sm">Account</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Email" value={user.email} />
          <Row label="Date of Birth" value={user.dob ? formatDate(user.dob) : null} />
          <Row label="Jurisdiction" value={user.jurisdiction} />
          <Row label="OAuth Provider" value={user.oauthProvider} />
          <Row label="Subscription Tier" value={user.subscriptionTier} />
          <Row label="Token Balance" value={user.tokenBalance} />
          <Row label="Free Messages Used" value={user.freeMessagesUsed} />
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
  router,
}: {
  conversations: UserDetail[];
  router: ReturnType<typeof useRouter>;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!conversations?.length) return <Empty label="No conversations" />;
  return (
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
                </TableCell>
              </TableRow>
              {isOpen && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={8} className="bg-muted/30 p-0">
                    <ConversationMessages
                      conversationId={c.id}
                      characterName={c.character?.name ?? c.characterId}
                    />
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
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
}: {
  conversationId: string;
  characterName: string;
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

  if (loading && messages.length === 0) {
    return <div className="py-6 text-center text-sm text-muted-foreground">Loading messages...</div>;
  }
  if (!loading && total === 0) {
    return <div className="py-6 text-center text-sm text-muted-foreground">No messages in this conversation</div>;
  }

  return (
    <div className="p-4 space-y-3 max-h-[28rem] overflow-y-auto">
      <p className="text-xs text-muted-foreground">
        {total} message{total === 1 ? "" : "s"} with {characterName}
      </p>
      {messages.map((m) => {
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
