"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface UserResult {
  id: string;
  email: string;
  name: string;
  platform: string;
  subscriptionTier: string;
  createdAt: string;
  score: number;
}

export default function DeletePage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [selected, setSelected] = useState<UserResult | null>(null);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (search.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const res = await fetch(
        `/api/users?search=${encodeURIComponent(search)}&limit=10`
      );
      const data = await res.json();
      setResults(data.users || []);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  async function handleDelete() {
    if (!selected || confirmEmail !== selected.email) return;
    setDeleting(true);

    const res = await fetch(`/api/users/${selected.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmEmail }),
    });
    const data = await res.json();

    if (res.ok) {
      toast.success(`User ${data.deleted} deleted permanently`);
      setSelected(null);
      setSearch("");
      setConfirmEmail("");
      setResults([]);
      router.refresh();
    } else {
      toast.error(data.error);
    }
    setDeleting(false);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Delete User</h1>
        <p className="text-muted-foreground mt-1">
          Permanently remove a user and all their data
        </p>
      </div>

      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-4 w-4" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Search for user</Label>
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelected(null);
                setConfirmEmail("");
              }}
              placeholder="Search by name or email"
            />
          </div>

          {results.length > 0 && !selected && (
            <div className="border rounded-md divide-y">
              {results.map((u) => (
                <button
                  key={u.id}
                  className="w-full text-left px-4 py-3 hover:bg-muted flex items-center justify-between"
                  onClick={() => setSelected(u)}
                >
                  <div>
                    <p className="font-medium text-sm">{u.name}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline">{u.platform}</Badge>
                    <Badge variant="secondary">{u.subscriptionTier}</Badge>
                  </div>
                </button>
              ))}
            </div>
          )}

          {selected && (
            <>
              <Card className="bg-muted/50">
                <CardContent className="py-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{selected.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {selected.email}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline">{selected.platform}</Badge>
                      <Badge>{selected.subscriptionTier}</Badge>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Engagement score: {selected.score} messages |
                    Created: {formatDate(selected.createdAt)}
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <Label className="text-red-600">
                  Type <code className="bg-muted px-1 rounded">{selected.email}</code> to confirm deletion
                </Label>
                <Input
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  placeholder={selected.email}
                  className="border-red-200"
                />
              </div>

              <Button
                variant="destructive"
                disabled={confirmEmail !== selected.email || deleting}
                onClick={handleDelete}
                className="w-full"
              >
                {deleting ? "Deleting…" : "Delete User Permanently"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
