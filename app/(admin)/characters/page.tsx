"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ShieldAlert } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface CharacterRow {
  id: string;
  name: string;
  owner: { email: string } | null;
  style: string;
  contentRating: string;
  moderationStatus: string;
  visibility: string;
  popularityScore: number;
  createdAt: string;
}

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

export default function CharactersPage() {
  const router = useRouter();
  const [characters, setCharacters] = useState<CharacterRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [rating, setRating] = useState("all");
  const [style, setStyle] = useState("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const limit = 25;

  const fetchCharacters = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: page.toString(),
      status,
      rating,
      style,
      ...(search && { search }),
    });
    const res = await fetch(`/api/characters?${params}`);
    const data = await res.json();
    setCharacters(data.characters);
    setTotal(data.total);
    setPendingCount(data.pendingCount);
    setLoading(false);
  }, [page, status, rating, style, search]);

  useEffect(() => {
    fetchCharacters();
  }, [fetchCharacters]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Characters</h1>
          <p className="text-muted-foreground mt-1">
            {total.toLocaleString()} total characters
          </p>
        </div>
        <Button
          variant={pendingCount > 0 ? "default" : "outline"}
          size="sm"
          onClick={() => router.push("/moderation")}
          className={pendingCount > 0 ? "bg-yellow-500 hover:bg-yellow-600 text-white" : ""}
        >
          <ShieldAlert className="h-4 w-4 mr-1" />
          Moderation Queue
          {pendingCount > 0 && (
            <Badge variant="secondary" className="ml-1.5 bg-white text-yellow-700 text-xs">
              {pendingCount}
            </Badge>
          )}
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-muted-foreground">Status:</span>
          <Select value={status} onValueChange={(v) => { if (v) { setStatus(v); setPage(1); } }}>
            <SelectTrigger className="w-[160px] h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>

          <span className="text-sm text-muted-foreground">Rating:</span>
          <Select value={rating} onValueChange={(v) => { if (v) { setRating(v); setPage(1); } }}>
            <SelectTrigger className="w-[130px] h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="sfw">SFW</SelectItem>
              <SelectItem value="mature">Mature</SelectItem>
            </SelectContent>
          </Select>

          <span className="text-sm text-muted-foreground">Style:</span>
          <Select value={style} onValueChange={(v) => { if (v) { setStyle(v); setPage(1); } }}>
            <SelectTrigger className="w-[140px] h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="realistic">Realistic</SelectItem>
              <SelectItem value="threeD">3D</SelectItem>
              <SelectItem value="anime">Anime</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="sm:ml-auto">
          <Input
            placeholder="Search by name..."
            className="max-w-xs"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Style</TableHead>
              <TableHead>Content Rating</TableHead>
              <TableHead>Moderation Status</TableHead>
              <TableHead>Visibility</TableHead>
              <TableHead>Popularity</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : characters.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No characters found
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
                    <Badge variant="outline" className="text-xs">{character.style}</Badge>
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
                    <ModerationBadge status={character.moderationStatus} />
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{character.visibility}</Badge>
                  </TableCell>
                  <TableCell className="text-sm font-semibold">{character.popularityScore}</TableCell>
                  <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                    {formatDate(character.createdAt)}
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
    </div>
  );
}
