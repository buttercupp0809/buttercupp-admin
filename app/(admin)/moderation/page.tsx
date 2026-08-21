"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle, XCircle, CheckCheck } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface CharacterRow {
  id: string;
  name: string;
  owner: { email: string } | null;
  style: string;
  contentRating: string;
  moderationStatus: string;
  createdAt: string;
}

export default function ModerationPage() {
  const router = useRouter();
  const [characters, setCharacters] = useState<CharacterRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const limit = 25;

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      status: "pending",
      rating: "all",
      style: "all",
      page: page.toString(),
    });
    const res = await fetch(`/api/characters?${params}`);
    const data = await res.json();

    // Sort: mature first, then oldest createdAt first
    const sorted: CharacterRow[] = (data.characters as CharacterRow[]).sort((a, b) => {
      if (a.contentRating === "mature" && b.contentRating !== "mature") return -1;
      if (a.contentRating !== "mature" && b.contentRating === "mature") return 1;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    setCharacters(sorted);
    setTotal(data.total);
    setLoading(false);
  }, [page]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  async function handleAction(id: string, action: "approve" | "reject") {
    setActionLoading(`${id}-${action}`);
    try {
      const res = await fetch(`/api/characters/${id}/moderate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Action failed");
        return;
      }
      setCharacters((prev) => prev.filter((c) => c.id !== id));
      setTotal((prev) => Math.max(0, prev - 1));
      toast.success(`Character ${action === "approve" ? "approved" : "rejected"}`);
    } catch {
      toast.error("Action failed");
    } finally {
      setActionLoading(null);
    }
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.push("/characters")} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" /> All Characters
        </Button>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Moderation Queue</h1>
          {total > 0 && (
            <Badge variant="destructive" className="text-sm px-2.5 py-0.5">
              {total}
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground mt-1">
          Pending characters sorted by mature content first, then oldest first.
        </p>
      </div>

      {!loading && characters.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
          <CheckCheck className="h-12 w-12 text-green-500" />
          <p className="text-lg font-medium">No characters pending moderation</p>
          <p className="text-sm text-muted-foreground">All caught up. Check back later.</p>
        </div>
      ) : (
        <>
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Content Rating</TableHead>
                  <TableHead>Style</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : (
                  characters.map((character) => (
                    <TableRow
                      key={character.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/characters/${character.id}`)}
                    >
                      <TableCell className="font-medium">{character.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {character.owner ? character.owner.email : (
                          <span className="italic">System</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={character.contentRating === "mature" ? "destructive" : "secondary"}
                          className="text-xs"
                        >
                          {character.contentRating}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{character.style}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {formatDate(character.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div
                          className="flex justify-end gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white h-7 px-2.5"
                            disabled={actionLoading !== null}
                            onClick={() => handleAction(character.id, "approve")}
                          >
                            {actionLoading === `${character.id}-approve` ? (
                              "..."
                            ) : (
                              <><CheckCircle className="h-3.5 w-3.5 mr-1" /> Approve</>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 px-2.5"
                            disabled={actionLoading !== null}
                            onClick={() => handleAction(character.id, "reject")}
                          >
                            {actionLoading === `${character.id}-reject` ? (
                              "..."
                            ) : (
                              <><XCircle className="h-3.5 w-3.5 mr-1" /> Reject</>
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * limit + 1}-{Math.min(page * limit, total)} of {total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
