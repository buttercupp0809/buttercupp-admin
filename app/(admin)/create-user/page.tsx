"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, UserPlus, Eye, EyeOff, CheckCircle2 } from "lucide-react";

interface CreatedUser {
  user: { id: string; email: string; name: string; createdAt: string };
  credentials: { email: string; password: string };
}

export default function CreateUserPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatedUser | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const res = await fetch("/api/users/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name: name || undefined }),
    });
    const data = await res.json();

    if (res.ok) {
      setCreated(data);
      toast.success(`User ${data.user.email} created`);
    } else {
      toast.error(data.error || "Failed to create user");
    }
    setSubmitting(false);
  }

  function reset() {
    setCreated(null);
    setEmail("");
    setPassword("");
    setName("");
    setShowPassword(false);
  }

  async function copy(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <UserPlus className="h-6 w-6" />
          Create User
        </h1>
        <p className="text-muted-foreground mt-1">
          Provision a new account with active subscription — usable immediately
        </p>
      </div>

      {!created ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Account details</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="off"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">
                  Display name <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Derived from email if blank"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Creates the user with <code className="font-mono">subscriptionTier=active</code>,
                an active subscription row, and a default personality —
                mirroring the reviewer-account script so the user passes the
                paywall on first sign-in.
              </div>

              <Button
                type="submit"
                disabled={submitting || !email || password.length < 8}
                className="w-full"
              >
                {submitting ? "Creating…" : "Create user"}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-green-200">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              User created successfully
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Field
                label="User ID"
                value={created.user.id}
                onCopy={() => copy(created.user.id, "User ID")}
                mono
              />
              <Field
                label="Email"
                value={created.credentials.email}
                onCopy={() =>
                  copy(created.credentials.email, "Email")
                }
              />
              <Field
                label="Password"
                value={created.credentials.password}
                onCopy={() =>
                  copy(created.credentials.password, "Password")
                }
                mono
              />
              <Field
                label="Display name"
                value={created.user.name}
                onCopy={() => copy(created.user.name, "Name")}
              />
            </div>

            <div className="rounded-md border bg-amber-50 border-amber-200 px-3 py-2 text-xs text-amber-900">
              Save this password now — it is hashed in the database and can&apos;t
              be shown again.
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <Badge variant="default">subscription: active</Badge>
              <Badge variant="outline">onboarding: complete</Badge>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={reset}>
                Create another
              </Button>
              <Button
                variant="default"
                onClick={() => router.push(`/users/${created.user.id}`)}
              >
                View user
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onCopy,
  mono = false,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <code
          className={`flex-1 rounded-md border bg-muted/30 px-3 py-2 text-sm break-all ${
            mono ? "font-mono" : ""
          }`}
        >
          {value}
        </code>
        <Button variant="outline" size="icon" onClick={onCopy} aria-label={`Copy ${label}`}>
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
