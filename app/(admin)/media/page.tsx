"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ImageIcon, Clock, AlertCircle } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

type StatusFilter = "all" | "queued" | "processing" | "ready" | "failed";
type KindFilter = "all" | "image" | "voice" | "video";

interface MediaAssetRow {
  id: string;
  userId: string;
  characterId: string | null;
  kind: string;
  s3Key: string;
  status: string;
  jobId: string | null;
  createdAt: string;
  user: { email: string };
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    queued: "bg-gray-100 text-gray-700",
    processing: "bg-blue-100 text-blue-700",
    ready: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? "bg-gray-100 text-gray-700"}`}
    >
      {status}
    </span>
  );
}

function KindBadge({ kind }: { kind: string }) {
  const styles: Record<string, string> = {
    image: "bg-purple-100 text-purple-700",
    voice: "bg-indigo-100 text-indigo-700",
    video: "bg-pink-100 text-pink-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[kind] ?? "bg-gray-100 text-gray-700"}`}
    >
      {kind}
    </span>
  );
}

export default function MediaPage() {
  const [assets, setAssets] = useState<MediaAssetRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [kind, setKind] = useState<KindFilter>("all");
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const limit = 50;

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: page.toString(), status, kind });
    const res = await fetch(`/api/media?${params}`);
    const data = await res.json();
    setAssets(data.assets ?? []);
    setTotal(data.total ?? 0);
    setCounts(data.counts ?? {});
    setLoading(false);
  }, [page, status, kind]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  function handleStatusChange(v: string) {
    setStatus(v as StatusFilter);
    setPage(1);
  }

  function handleKindChange(v: string) {
    setKind(v as KindFilter);
    setPage(1);
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ImageIcon className="h-6 w-6 text-purple-500" />
          Media Assets
        </h1>
        <p className="text-muted-foreground mt-1">Monitor generated media assets</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground font-normal">
              <Clock className="h-4 w-4 text-gray-500" />
              Queued
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{(counts.queued ?? 0).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground font-normal">
              <Clock className="h-4 w-4 text-blue-500" />
              Processing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">
              {(counts.processing ?? 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground font-normal">
              <AlertCircle className="h-4 w-4 text-red-500" />
              Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">
              {(counts.failed ?? 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Status:</span>
          <Select value={status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[140px] h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="queued">Queued</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="ready">Ready</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Kind:</span>
          <Select value={kind} onValueChange={handleKindChange}>
            <SelectTrigger className="w-[120px] h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="image">Image</SelectItem>
              <SelectItem value="voice">Voice</SelectItem>
              <SelectItem value="video">Video</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User Email</TableHead>
              <TableHead className="w-24">Kind</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-36">Job ID</TableHead>
              <TableHead>S3 Key</TableHead>
              <TableHead className="w-40">Created At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : assets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No assets found
                </TableCell>
              </TableRow>
            ) : (
              assets.map((asset) => (
                <TableRow
                  key={asset.id}
                  className={asset.status === "failed" ? "bg-red-50" : undefined}
                >
                  <TableCell className="text-sm">{asset.user.email}</TableCell>
                  <TableCell>
                    <KindBadge kind={asset.kind} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={asset.status} />
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-[140px]">
                    {asset.jobId ? asset.jobId.slice(0, 16) + "..." : "-"}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-[200px]">
                    {asset.s3Key.length > 40 ? "..." + asset.s3Key.slice(-38) : asset.s3Key}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateTime(asset.createdAt)}
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
