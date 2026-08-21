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
import { ArrowLeft, CheckCircle, XCircle, Eye, EyeOff, Trash2, Pencil, X } from "lucide-react";
import { formatDate } from "@/lib/utils";
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

const fieldClass = "w-full border rounded px-2 py-1 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring";
const taClass = `${fieldClass} min-h-[80px] resize-y`;

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
  const [deleteMediaId, setDeleteMediaId] = useState<string | null>(null);
  const [deletingMedia, setDeletingMedia] = useState(false);

  // --- Info tab edit state ---
  const [infoEdit, setInfoEdit] = useState(false);
  const [infoForm, setInfoForm] = useState<Record<string, string>>({});
  const [savingInfo, setSavingInfo] = useState(false);

  // --- Current Version tab edit state ---
  const [versionEdit, setVersionEdit] = useState(false);
  const [versionForm, setVersionForm] = useState<Record<string, string>>({});
  const [savingVersion, setSavingVersion] = useState(false);

  // --- Appearance tab edit state ---
  const [appearEdit, setAppearEdit] = useState(false);
  const [appearForm, setAppearForm] = useState<Record<string, string>>({});
  const [savingAppear, setSavingAppear] = useState(false);

  // --- Voice tab edit state ---
  const [voiceEdit, setVoiceEdit] = useState(false);
  const [voiceForm, setVoiceForm] = useState<Record<string, string>>({});
  const [savingVoice, setSavingVoice] = useState(false);

  // --- Media row edit state ---
  const [mediaEditId, setMediaEditId] = useState<string | null>(null);
  const [mediaForm, setMediaForm] = useState<Record<string, string | boolean | number>>({});
  const [savingMedia, setSavingMedia] = useState(false);

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

  async function handleDeleteMedia() {
    if (!deleteMediaId) return;
    setDeletingMedia(true);
    try {
      const res = await fetch(`/api/characters/${id}/media/${deleteMediaId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to delete media");
        return;
      }
      toast.success("Media deleted");
      setCharacter((prev: CharacterDetail) =>
        prev ? { ...prev, media: prev.media.filter((m: CharacterDetail) => m.id !== deleteMediaId) } : prev
      );
      setDeleteMediaId(null);
    } catch {
      toast.error("Failed to delete media");
    } finally {
      setDeletingMedia(false);
    }
  }

  // --- Info tab ---
  function startInfoEdit() {
    setInfoForm({
      name: character.name ?? "",
      bio: character.bio ?? "",
      age: character.age != null ? String(character.age) : "",
      gender: character.gender ?? "",
      location: character.location ?? "",
      style: character.style ?? "",
      contentRating: character.contentRating ?? "",
      visibility: character.visibility ?? "",
      tags: (character.tags ?? []).join(", "),
      popularityScore: character.popularityScore != null ? String(character.popularityScore) : "",
      seedKey: character.seedKey ?? "",
    });
    setInfoEdit(true);
  }

  async function saveInfo() {
    setSavingInfo(true);
    try {
      const payload: Record<string, unknown> = {
        name: infoForm.name || undefined,
        bio: infoForm.bio || undefined,
        age: infoForm.age !== "" ? Number(infoForm.age) : null,
        gender: infoForm.gender || undefined,
        location: infoForm.location || undefined,
        style: infoForm.style || undefined,
        contentRating: infoForm.contentRating || undefined,
        visibility: infoForm.visibility || undefined,
        tags: infoForm.tags
          ? infoForm.tags.split(",").map((t) => t.trim()).filter(Boolean)
          : [],
        popularityScore: infoForm.popularityScore !== "" ? Number(infoForm.popularityScore) : undefined,
        seedKey: infoForm.seedKey || undefined,
      };
      const res = await fetch(`/api/characters/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Save failed");
        return;
      }
      setCharacter((prev: CharacterDetail) => prev ? { ...prev, ...data } : prev);
      setInfoEdit(false);
      toast.success("Character info updated");
    } catch {
      toast.error("Save failed");
    } finally {
      setSavingInfo(false);
    }
  }

  // --- Version tab ---
  function startVersionEdit() {
    const cv = character.currentVersion;
    setVersionForm({
      personality: cv.personality ?? "",
      backstory: cv.backstory ?? "",
      behavioralInstructions: cv.behavioralInstructions ?? "",
      greeting: cv.greeting ?? "",
      systemPromptSnapshot: cv.systemPromptSnapshot ?? "",
    });
    setVersionEdit(true);
  }

  async function saveVersion() {
    setSavingVersion(true);
    try {
      const res = await fetch(`/api/characters/${id}/version`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(versionForm),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Save failed");
        return;
      }
      setCharacter((prev: CharacterDetail) =>
        prev ? { ...prev, currentVersion: { ...prev.currentVersion, ...data } } : prev
      );
      setVersionEdit(false);
      toast.success("Version updated");
    } catch {
      toast.error("Save failed");
    } finally {
      setSavingVersion(false);
    }
  }

  // --- Appearance tab ---
  function startAppearEdit() {
    const sheet = character.currentVersion.appearanceSheet;
    setAppearForm({
      stylePrompt: sheet.stylePrompt ?? "",
      negativePrompt: sheet.negativePrompt ?? "",
      loraRef: sheet.loraRef ?? "",
      referenceImageKeys: (sheet.referenceImageKeys ?? []).join("\n"),
      traits: sheet.traits ? JSON.stringify(sheet.traits, null, 2) : "",
    });
    setAppearEdit(true);
  }

  async function saveAppear() {
    setSavingAppear(true);
    try {
      const payload = {
        stylePrompt: appearForm.stylePrompt || undefined,
        negativePrompt: appearForm.negativePrompt || undefined,
        loraRef: appearForm.loraRef || undefined,
        referenceImageKeys: appearForm.referenceImageKeys
          ? appearForm.referenceImageKeys.split("\n").map((k) => k.trim()).filter(Boolean)
          : [],
        traits: appearForm.traits || undefined,
      };
      const res = await fetch(`/api/characters/${id}/appearance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Save failed");
        return;
      }
      setCharacter((prev: CharacterDetail) =>
        prev
          ? {
              ...prev,
              currentVersion: {
                ...prev.currentVersion,
                appearanceSheet: { ...prev.currentVersion.appearanceSheet, ...data },
              },
            }
          : prev
      );
      setAppearEdit(false);
      toast.success("Appearance updated");
    } catch {
      toast.error("Save failed");
    } finally {
      setSavingAppear(false);
    }
  }

  // --- Voice tab ---
  function startVoiceEdit() {
    const vp = character.currentVersion.voiceProfile;
    setVoiceForm({
      provider: vp.provider ?? "",
      voiceId: vp.voiceId ?? "",
      previewKey: vp.previewKey ?? "",
      params: vp.params ? JSON.stringify(vp.params, null, 2) : "",
    });
    setVoiceEdit(true);
  }

  async function saveVoice() {
    setSavingVoice(true);
    try {
      const payload = {
        provider: voiceForm.provider || undefined,
        voiceId: voiceForm.voiceId || undefined,
        previewKey: voiceForm.previewKey || undefined,
        params: voiceForm.params || undefined,
      };
      const res = await fetch(`/api/characters/${id}/voice`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Save failed");
        return;
      }
      setCharacter((prev: CharacterDetail) =>
        prev
          ? {
              ...prev,
              currentVersion: {
                ...prev.currentVersion,
                voiceProfile: { ...prev.currentVersion.voiceProfile, ...data },
              },
            }
          : prev
      );
      setVoiceEdit(false);
      toast.success("Voice profile updated");
    } catch {
      toast.error("Save failed");
    } finally {
      setSavingVoice(false);
    }
  }

  // --- Media row edit ---
  function startMediaEdit(m: CharacterDetail) {
    setMediaEditId(m.id);
    setMediaForm({
      title: m.title ?? "",
      sort: m.sort ?? 0,
      isPrimary: m.isPrimary ?? false,
      isDisplay: m.isDisplay ?? false,
      isMain: m.isMain ?? false,
      hidden: m.hidden ?? false,
      kind: m.kind ?? "image",
    });
  }

  async function saveMedia(mediaId: string) {
    setSavingMedia(true);
    try {
      const res = await fetch(`/api/characters/${id}/media/${mediaId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mediaForm),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Save failed");
        return;
      }
      setCharacter((prev: CharacterDetail) =>
        prev
          ? {
              ...prev,
              media: prev.media.map((m: CharacterDetail) =>
                m.id === mediaId ? { ...m, ...data } : m
              ),
            }
          : prev
      );
      setMediaEditId(null);
      toast.success("Media updated");
    } catch {
      toast.error("Save failed");
    } finally {
      setSavingMedia(false);
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

        {/* INFO TAB */}
        <TabsContent value="info" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm">Character Info</CardTitle>
              {!infoEdit ? (
                <Button size="sm" variant="outline" onClick={startInfoEdit}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setInfoEdit(false)}>
                    <X className="h-3.5 w-3.5 mr-1" /> Cancel
                  </Button>
                  <Button size="sm" disabled={savingInfo} onClick={saveInfo}>
                    {savingInfo ? "Saving..." : "Save"}
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="pt-2 space-y-4">
              {infoEdit ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Name</label>
                    <Input
                      value={infoForm.name}
                      onChange={(e) => setInfoForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Name"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Bio</label>
                    <textarea
                      className={taClass}
                      value={infoForm.bio}
                      onChange={(e) => setInfoForm((f) => ({ ...f, bio: e.target.value }))}
                      placeholder="Bio"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Age</label>
                      <Input
                        type="number"
                        value={infoForm.age}
                        onChange={(e) => setInfoForm((f) => ({ ...f, age: e.target.value }))}
                        placeholder="Age"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Gender</label>
                      <Input
                        value={infoForm.gender}
                        onChange={(e) => setInfoForm((f) => ({ ...f, gender: e.target.value }))}
                        placeholder="Gender"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Location</label>
                    <Input
                      value={infoForm.location}
                      onChange={(e) => setInfoForm((f) => ({ ...f, location: e.target.value }))}
                      placeholder="Location"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Style</label>
                      <select
                        className={fieldClass}
                        value={infoForm.style}
                        onChange={(e) => setInfoForm((f) => ({ ...f, style: e.target.value }))}
                      >
                        <option value="realistic">realistic</option>
                        <option value="threeD">threeD</option>
                        <option value="anime">anime</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Content Rating</label>
                      <select
                        className={fieldClass}
                        value={infoForm.contentRating}
                        onChange={(e) => setInfoForm((f) => ({ ...f, contentRating: e.target.value }))}
                      >
                        <option value="sfw">sfw</option>
                        <option value="mature">mature</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Visibility</label>
                      <select
                        className={fieldClass}
                        value={infoForm.visibility}
                        onChange={(e) => setInfoForm((f) => ({ ...f, visibility: e.target.value }))}
                      >
                        <option value="private">private</option>
                        <option value="public">public</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Tags (comma-separated)</label>
                    <Input
                      value={infoForm.tags}
                      onChange={(e) => setInfoForm((f) => ({ ...f, tags: e.target.value }))}
                      placeholder="tag1, tag2, tag3"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Popularity Score</label>
                      <Input
                        type="number"
                        value={infoForm.popularityScore}
                        onChange={(e) => setInfoForm((f) => ({ ...f, popularityScore: e.target.value }))}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Seed Key</label>
                      <Input
                        value={infoForm.seedKey}
                        onChange={(e) => setInfoForm((f) => ({ ...f, seedKey: e.target.value }))}
                        placeholder="seed-key"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <>
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
                  {!character.bio && !character.tags?.length && !character.seedKey && (
                    <p className="text-sm text-muted-foreground">No additional info</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* VERSIONS TAB (read-only) */}
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

        {/* CURRENT VERSION TAB */}
        <TabsContent value="current" className="mt-4">
          {!character.currentVersion ? (
            <Empty label="No current version set" />
          ) : (
            <div className="space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm">Version {character.currentVersion.versionNo}</CardTitle>
                  {!versionEdit ? (
                    <Button size="sm" variant="outline" onClick={startVersionEdit}>
                      <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setVersionEdit(false)}>
                        <X className="h-3.5 w-3.5 mr-1" /> Cancel
                      </Button>
                      <Button size="sm" disabled={savingVersion} onClick={saveVersion}>
                        {savingVersion ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {versionEdit ? (
                    <div className="space-y-3">
                      {(["personality", "backstory", "behavioralInstructions", "greeting", "systemPromptSnapshot"] as const).map((field) => (
                        <div key={field} className="space-y-1">
                          <label className="text-xs text-muted-foreground capitalize">
                            {field.replace(/([A-Z])/g, " $1")}
                          </label>
                          <textarea
                            className={taClass}
                            value={versionForm[field]}
                            onChange={(e) => setVersionForm((f) => ({ ...f, [field]: e.target.value }))}
                            placeholder={field}
                            rows={field === "systemPromptSnapshot" ? 6 : 3}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
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
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* APPEARANCE TAB */}
        <TabsContent value="appearance" className="mt-4">
          {!character.currentVersion?.appearanceSheet ? (
            <Empty label="No appearance sheet on current version" />
          ) : (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm">Appearance Sheet</CardTitle>
                {!appearEdit ? (
                  <Button size="sm" variant="outline" onClick={startAppearEdit}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setAppearEdit(false)}>
                      <X className="h-3.5 w-3.5 mr-1" /> Cancel
                    </Button>
                    <Button size="sm" disabled={savingAppear} onClick={saveAppear}>
                      {savingAppear ? "Saving..." : "Save"}
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="pt-2 space-y-4 text-sm">
                {appearEdit ? (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Style Prompt</label>
                      <textarea
                        className={taClass}
                        value={appearForm.stylePrompt}
                        onChange={(e) => setAppearForm((f) => ({ ...f, stylePrompt: e.target.value }))}
                        placeholder="Style prompt"
                        rows={3}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Negative Prompt</label>
                      <textarea
                        className={taClass}
                        value={appearForm.negativePrompt}
                        onChange={(e) => setAppearForm((f) => ({ ...f, negativePrompt: e.target.value }))}
                        placeholder="Negative prompt"
                        rows={3}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">LoRA Ref</label>
                      <Input
                        value={appearForm.loraRef}
                        onChange={(e) => setAppearForm((f) => ({ ...f, loraRef: e.target.value }))}
                        placeholder="LoRA reference"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Reference Image Keys (one per line)</label>
                      <textarea
                        className={taClass}
                        value={appearForm.referenceImageKeys}
                        onChange={(e) => setAppearForm((f) => ({ ...f, referenceImageKeys: e.target.value }))}
                        placeholder="images/key1&#10;images/key2"
                        rows={3}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Traits (JSON)</label>
                      <textarea
                        className={taClass}
                        value={appearForm.traits}
                        onChange={(e) => setAppearForm((f) => ({ ...f, traits: e.target.value }))}
                        placeholder='{"hairColor": "blonde"}'
                        rows={4}
                      />
                    </div>
                  </div>
                ) : (
                  <>
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
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* VOICE TAB */}
        <TabsContent value="voice" className="mt-4">
          {!character.currentVersion?.voiceProfile ? (
            <Empty label="No voice profile on current version" />
          ) : (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm">Voice Profile</CardTitle>
                {!voiceEdit ? (
                  <Button size="sm" variant="outline" onClick={startVoiceEdit}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setVoiceEdit(false)}>
                      <X className="h-3.5 w-3.5 mr-1" /> Cancel
                    </Button>
                    <Button size="sm" disabled={savingVoice} onClick={saveVoice}>
                      {savingVoice ? "Saving..." : "Save"}
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="pt-2 space-y-4 text-sm">
                {voiceEdit ? (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Provider</label>
                      <Input
                        value={voiceForm.provider}
                        onChange={(e) => setVoiceForm((f) => ({ ...f, provider: e.target.value }))}
                        placeholder="Provider"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Voice ID</label>
                      <Input
                        value={voiceForm.voiceId}
                        onChange={(e) => setVoiceForm((f) => ({ ...f, voiceId: e.target.value }))}
                        placeholder="Voice ID"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Preview Key</label>
                      <Input
                        value={voiceForm.previewKey}
                        onChange={(e) => setVoiceForm((f) => ({ ...f, previewKey: e.target.value }))}
                        placeholder="Preview key"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Params (JSON)</label>
                      <textarea
                        className={taClass}
                        value={voiceForm.params}
                        onChange={(e) => setVoiceForm((f) => ({ ...f, params: e.target.value }))}
                        placeholder='{"speed": 1.0}'
                        rows={4}
                      />
                    </div>
                  </div>
                ) : (
                  <>
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
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* MEDIA TAB */}
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
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {character.media.map((m: CharacterDetail) => {
                    const isEditing = mediaEditId === m.id;
                    return (
                      <TableRow key={m.id}>
                        <TableCell>
                          {isEditing ? (
                            <select
                              className={fieldClass}
                              value={String(mediaForm.kind)}
                              onChange={(e) => setMediaForm((f) => ({ ...f, kind: e.target.value }))}
                            >
                              <option value="image">image</option>
                              <option value="video">video</option>
                            </select>
                          ) : (
                            <Badge variant={m.kind === "video" ? "default" : "secondary"} className="text-xs">
                              {m.kind}
                            </Badge>
                          )}
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
                        <TableCell className="text-sm">
                          {isEditing ? (
                            <Input
                              value={String(mediaForm.title)}
                              onChange={(e) => setMediaForm((f) => ({ ...f, title: e.target.value }))}
                              placeholder="Title"
                              className="w-32"
                            />
                          ) : (
                            m.title || "—"
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <input
                              type="checkbox"
                              checked={Boolean(mediaForm.isPrimary)}
                              onChange={(e) => setMediaForm((f) => ({ ...f, isPrimary: e.target.checked }))}
                            />
                          ) : (
                            m.isPrimary ? "Yes" : "No"
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <input
                              type="checkbox"
                              checked={Boolean(mediaForm.isDisplay)}
                              onChange={(e) => setMediaForm((f) => ({ ...f, isDisplay: e.target.checked }))}
                            />
                          ) : (
                            m.isDisplay ? "Yes" : "No"
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <input
                              type="checkbox"
                              checked={Boolean(mediaForm.isMain)}
                              onChange={(e) => setMediaForm((f) => ({ ...f, isMain: e.target.checked }))}
                            />
                          ) : (
                            m.isMain ? "Yes" : "No"
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <input
                              type="checkbox"
                              checked={Boolean(mediaForm.hidden)}
                              onChange={(e) => setMediaForm((f) => ({ ...f, hidden: e.target.checked }))}
                            />
                          ) : (
                            m.hidden ? "Yes" : "No"
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input
                              type="number"
                              value={String(mediaForm.sort)}
                              onChange={(e) => setMediaForm((f) => ({ ...f, sort: Number(e.target.value) }))}
                              className="w-16"
                            />
                          ) : (
                            m.sort
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          {formatDate(m.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {isEditing ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setMediaEditId(null)}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  disabled={savingMedia}
                                  onClick={() => saveMedia(m.id)}
                                >
                                  {savingMedia ? "..." : "Save"}
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => startMediaEdit(m)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setDeleteMediaId(m.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Delete Media Dialog */}
      <Dialog open={!!deleteMediaId} onOpenChange={(open) => { if (!open) setDeleteMediaId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Media</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mt-2">
            This will permanently delete the media from S3 and the database. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteMediaId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={deletingMedia} onClick={handleDeleteMedia}>
              {deletingMedia ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
