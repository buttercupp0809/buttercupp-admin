"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Users,
  Mail,
  Server,
  Trash2,
  LogOut,
  Menu,
  MessageSquareWarning,
  Flame,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/users", label: "Users", icon: Users },
  { href: "/power-users", label: "Power Users", icon: Flame },
  { href: "/feedback", label: "Feedback", icon: MessageSquareWarning },
  { href: "/create-user", label: "Create User", icon: UserPlus },
  { href: "/email", label: "Email", icon: Mail },
  { href: "/aws", label: "AWS Costs", icon: Server },
  { href: "/delete", label: "Delete User", icon: Trash2 },
];

function NavContent({ pathname, onLogout }: { pathname: string; onLogout: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">V</span>
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight">Vesspr Admin</h1>
            <p className="text-[11px] text-muted-foreground">Internal Portal</p>
          </div>
        </div>
      </div>

      <Separator />

      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className={cn("h-4 w-4", active && "text-primary")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <Separator />

      <div className="px-3 py-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground text-[13px]"
          onClick={onLogout}
        >
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <>
      {/* Mobile trigger */}
      <div className="fixed top-4 left-4 z-50 lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={<Button variant="outline" size="icon" className="h-9 w-9 shadow-sm" />}
          >
            <Menu className="h-4 w-4" />
          </SheetTrigger>
          <SheetContent side="left" className="w-60 p-0">
            <NavContent pathname={pathname} onLogout={handleLogout} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-[240px] lg:flex-col border-r border-border bg-card">
        <NavContent pathname={pathname} onLogout={handleLogout} />
      </aside>
    </>
  );
}
