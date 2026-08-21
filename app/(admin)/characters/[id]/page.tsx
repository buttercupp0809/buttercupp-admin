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
import { ArrowLeft, CheckCircle, XCircle, Eye, EyeOff } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/utils";
import { mediaUrl, isImageUrl } from "@/lib/media-url";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CharacterDetail = any;

const MODERATION_STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  approved: "bg-green-100 text-green-800 border-green-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
};

function ModerationBadge({ status }: { status: string }) {
  const cls = MODERATION_STATUS_COLORS[status] ?? "bg-gray-100 text-gray-700 border-gray-200";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {status}
    </span>
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

export default function CharacterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [character, setCharacter] = useState<CharacterDetail>(null);
  const [loading, setLoading] = useState(true);
  const [moderateOpen, setModerateOpen] = useState(false);
  const [moderateAction, setModerateAction] = useState<"approve" | "reject">("approve");
  const [moderateReason, setModerateReason] = useState("");
  const [moderating, setModerating] = useState(false);
  const [togglingVisibility, setTogglingVisibility] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/characters/${id}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          toast.error(data?.error || "Failed to load character");
          router.push("/characters");
          return;
        }
        setCharacter(data);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load character", err);
        toast.error("Failed to load character");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, router]);

  function openModerateDialog(action: "approve" | "reject") {
    setModerateAction(action);
    setModerateReason("");
    setModerateOpen(true);
  }

  async function handleModerate() {
    setModerating(true);
    try {
      const res = await fetch(`/api/characters/${id}/moderate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: moderateAction, reason: moderateReason || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Moderation failed");
        return;
      }
      toast.success(`Character ${moderateAction === "approve" ? "approved" : "rejected"}`);
      setCharacter((prev: CharacterDetail) =>
        prev
          ? {
              ...prev,
              moderationStatus: data.moderationStatus,
              visibility: moderateAction === "approve" ? "public" : prev.visibility,
            }
          : prev
      );
      setModerateOpen(false);
    } catch {
      toast.error("Moderation failed");
    } finally {
      setModerating(false);
    }
  }

  async function handleToggleVisibility() {
    if (!character) return;
    setTogglingVisibility(true);
    const newVisibility = character.visibility === "public" ? "private" : "public";
    try {
      const res = await fetch(`/api/characters/${id}/moderate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: newVisibility === "public" ? "approve" : "reject" }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to toggle visibility");
        return;
      }
      setCharacter((prev: CharacterDetail) =>
        prev ? { ...prev, visibility: newVisibility, moderationStatus: data.moderationStatus } : prev
      );
      toast.success(`Visibility set to ${newVisibility}`);
    } catch {
      toast.error("Failed to toggle visibility");
    } finally {
      setTogglingVisibility(false);
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Loading character...</div>;
  }

  if (!character) return null;

  const canApprove = character.moderationStatus !== "approved";
  const canReject = character.moderationStatus !== "rejected";

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.push("/characters")}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Characters
      </Button>

      {/* Header Card */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-xl">{character.name}</CardTitle>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <Badge variant="outline" className="text-xs">{character.style}</Badge>
              <Badge
                variant={character.contentRating === "mature" ? "destructive" : "secondary"}
                className="text-xs"
              >
                {character.contentRating}
              </Badge>
              <Badge variant="outline" className="text-xs">{character.visibility}</Badge>
              <ModerationBadge status={character.moderationStatus} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            {canApprove && (
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => openModerateDialog("approve")}
              >
                <CheckCircle className="h-4 w-4 mr-1" /> Approve
              </Button>
            )}
            {canReject && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => openModerateDialog("reject")}
              >
                <XCircle className="h-4 w-4 mr-1" /> Reject
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={togglingVisibility}
              onClick={handleToggleVisibility}
            >
              {character.visibility === "public" ? (
                <><EyeOff className="h-4 w-4 mr-1" /> Make Private</>
              ) : (
                <><Eye className="h-4 w-4 mr-1" /> Make Public</>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 text-sm">
            {character.age != null && <span>Age: {character.age}</span>}
            {character.gender && <span>Gender: {character.gender}</span>}
            {character.location && <span>Location: {character.location}</span>}
            <span>Popularity: {character.popularityScore}</span>
            <span>Created: {formatDate(character.createdAt)}</span>
          </div>
          <div className="mt-3 text-sm">
            <span className="text-muted-foreground">Owner: </span>
            {character.owner ? (
              <button
                className="text-primary underline-offset-2 hover:underline"
                onClick={() => router.push(`/users/${character.owner.id}`)}
              >
                {character.owner.email}
              </button>
            ) : (
              <span className="italic text-muted-foreground">System Character</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="info">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="info">Info</TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
          <TabsTrigger value="current">Current Version</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="voice">Voice</TabsTrigger>
          <TabsTrigger value="media">Media</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              {character.bio && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Bio</p>
                  <p className="text-sm">{character.bio}</p>
                </div>
              )}
              {character.tags?.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {character.tags.map((tag: string) => (
                      <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {character.seedKey && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Seed Key</p>
                  <code className="text-xs bg-muted px-2 py-1 rounded">{character.seedKey}</code>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="versions" className="mt-4">
          {!character.versions?.length ? (
            <Empty label="No versions" />
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Version</TableHead>
                    <TableHead>Personality</TableHead>
                    <TableHead>Backstory</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {character.versions.map((v: CharacterDetail) => (
                    <TableRow key={v.id}>
                      <TableCell>
                        <Badge variant="outline">v{v.versionNo}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm">
                        {v.personality?.slice(0, 100) || "—"}
                        {v.personality?.length > 100 ? "..." : ""}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm">
                        {v.backstory?.slice(0, 100) || "—"}
                        {v.backstory?.length > 100 ? "..." : ""}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {formatDate(v.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="current" className="mt-4">
          {!character.currentVersion ? (
            <Empty label="No current version set" />
          ) : (
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle className="text-sm">Version {character.currentVersion.versionNo}</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {character.currentVersion.personality && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Personality</p>
                      <p className="text-sm">{character.currentVersion.personality}</p>
                    </div>
                  )}
                  {character.currentVersion.backstory && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Backstory</p>
                      <p className="text-sm">{character.currentVersion.backstory}</p>
                    </div>
                  )}
                  {character.currentVersion.behavioralInstructions && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Behavioral Instructions</p>
                      <p className="text-sm">{character.currentVersion.behavioralInstructions}</p>
                    </div>
                  )}
                  {character.currentVersion.greeting && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Greeting</p>
                      <p className="text-sm">{character.currentVersion.greeting}</p>
                    </div>
                  )}
                  {character.currentVersion.systemPromptSnapshot && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">System Prompt Snapshot</p>
                      <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-64 whitespace-pre-wrap">
                        {character.currentVersion.systemPromptSnapshot}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="appearance" className="mt-4">
          {!character.currentVersion?.appearanceSheet ? (
            <Empty label="No appearance sheet on current version" />
          ) : (
            <Card>
              <CardContent className="pt-6 space-y-4 text-sm">
                <Row label="Style Prompt" value={character.currentVersion.appearanceSheet.stylePrompt} />
                <Row label="Negative Prompt" value={character.currentVersion.appearanceSheet.negativePrompt} />
                <Row label="LoRA Ref" value={character.currentVersion.appearanceSheet.loraRef} />
                {character.currentVersion.appearanceSheet.referenceImageKeys?.length > 0 && (
                  <div>
                    <p className="text-muted-foreground mb-1">Reference Image Keys</p>
                    <ul className="list-disc list-inside space-y-1">
                      {character.currentVersion.appearanceSheet.referenceImageKeys.map((key: string, i: number) => (
                        <li key={i} className="font-mono text-xs">{key}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {character.currentVersion.appearanceSheet.traits && (
                  <div>
                    <p className="text-muted-foreground mb-1">Traits (JSON)</p>
                    <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-64 whitespace-pre-wrap">
                      {JSON.stringify(character.currentVersion.appearanceSheet.traits, null, 2)}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="voice" className="mt-4">
          {!character.currentVersion?.voiceProfile ? (
            <Empty label="No voice profile on current version" />
          ) : (
            <Card>
              <CardContent className="pt-6 space-y-4 text-sm">
                <Row label="Provider" value={character.currentVersion.voiceProfile.provider} />
                <Row label="Voice ID" value={character.currentVersion.voiceProfile.voiceId} />
                <Row label="Preview Key" value={character.currentVersion.voiceProfile.previewKey} />
                {character.currentVersion.voiceProfile.params && (
                  <div>
                    <p className="text-muted-foreground mb-1">Params (JSON)</p>
                    <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-48 whitespace-pre-wrap">
                      {JSON.stringify(character.currentVersion.voiceProfile.params, null, 2)}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="media" className="mt-4">
          {!character.media?.length ? (
            <Empty label="No media" />
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kind</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Primary</TableHead>
                    <TableHead>Display</TableHead>
                    <TableHead>Main</TableHead>
                    <TableHead>Hidden</TableHead>
                    <TableHead>Sort</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {character.media.map((m: CharacterDetail) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <Badge variant={m.kind === "video" ? "default" : "secondary"} className="text-xs">
                          {m.kind}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <a
                          href={mediaUrl(m.url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {isImageUrl(m.url) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={mediaUrl(m.url)}
                              alt={m.title || "media"}
                              className="h-12 w-12 rounded object-cover border bg-muted"
                              loading="lazy"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                              }}
                            />
                          ) : (
                            <span className="h-12 w-12 rounded border bg-muted flex items-center justify-center text-[10px] text-muted-foreground">
                              {m.kind}
                            </span>
                          )}
                          <span className="text-primary underline-offset-2 hover:underline text-xs truncate max-w-[160px]">
                            {m.url}
                          </span>
                        </a>
                      </TableCell>
                      <TableCell className="text-sm">{m.title || "—"}</TableCell>
                      <TableCell>{m.isPrimary ? "Yes" : "No"}</TableCell>
                      <TableCell>{m.isDisplay ? "Yes" : "No"}</TableCell>
                      <TableCell>{m.isMain ? "Yes" : "No"}</TableCell>
                      <TableCell>{m.hidden ? "Yes" : "No"}</TableCell>
                      <TableCell>{m.sort}</TableCell>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {formatDate(m.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Moderate Dialog */}
      <Dialog open={moderateOpen} onOpenChange={setModerateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {moderateAction === "approve" ? "Approve" : "Reject"} Character
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              {moderateAction === "approve"
                ? `Approving "${character.name}" will set it to approved and make it public.`
                : `Rejecting "${character.name}" will set it to rejected.`}
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason (optional)</label>
              <Input
                value={moderateReason}
                onChange={(e) => setModerateReason(e.target.value)}
                placeholder="Enter a reason..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModerateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={moderateAction === "approve" ? "default" : "destructive"}
              className={moderateAction === "approve" ? "bg-green-600 hover:bg-green-700" : ""}
              disabled={moderating}
              onClick={handleModerate}
            >
              {moderating
                ? moderateAction === "approve" ? "Approving..." : "Rejecting..."
                : moderateAction === "approve" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
