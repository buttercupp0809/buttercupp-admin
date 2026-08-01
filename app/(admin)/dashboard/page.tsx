"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GrowthChart } from "@/components/charts/growth-chart";
import { ActiveUsersChart } from "@/components/charts/active-users-chart";
import { MessagesChart } from "@/components/charts/messages-chart";
import { TierPieChart } from "@/components/charts/tier-pie-chart";
import { PlatformBarChart } from "@/components/charts/platform-bar-chart";
import { CountryBarChart } from "@/components/charts/country-bar-chart";
import { UsageChart } from "@/components/charts/usage-chart";
import {
  Users,
  MessageSquare,
  Crown,
  Activity,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  TrendingUp,
  Flame,
} from "lucide-react";
import { formatCountry, formatDate } from "@/lib/utils";

type DateRange = "7" | "30" | "90" | "all";

interface OnboardingStats {
  total: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  completionRate: number;
  dropoffByStep: Array<{ step: number; count: number }>;
}

interface TrialUser {
  id: string;
  name: string;
  email: string;
  platform: string;
  country: string | null;
  subscriptionTier: string;
  trialEndsAt: string;
  trialStatus: string;
  onboardingComplete: boolean;
  daysLeft: number;
}

interface TrialStats {
  total: number;
  active: number;
  expiring3d: number;
  expiring7d: number;
  expired: number;
  converted: number;
  highEngagementFree: number;
  urgentUsers: TrialUser[];
}

export default function DashboardPage() {
  const router = useRouter();
  const [range, setRange] = useState<DateRange>("30");
  const [summary, setSummary] = useState({
    totalUsers: 0,
    activeToday: 0,
    messagesToday: 0,
    paidSubscribers: 0,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [growth, setGrowth] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [active, setActive] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [messages, setMessages] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [tiers, setTiers] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [platforms, setPlatforms] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [countries, setCountries] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [usage, setUsage] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [events, setEvents] = useState<any[]>([]);
  const [onboardingStats, setOnboardingStats] = useState<OnboardingStats | null>(null);
  const [trialStats, setTrialStats] = useState<TrialStats | null>(null);

  const days = range === "all" ? "365" : range;

  const fetchAll = useCallback(async () => {
    const [s, g, a, m, t, p, c, u, e, ob, tr] = await Promise.all([
      fetch("/api/analytics/summary").then((r) => r.json()),
      fetch(`/api/analytics/growth?days=${days}`).then((r) => r.json()),
      fetch("/api/analytics/active").then((r) => r.json()),
      fetch(`/api/analytics/messages?days=${days}`).then((r) => r.json()),
      fetch("/api/analytics/tiers").then((r) => r.json()),
      fetch("/api/analytics/platforms").then((r) => r.json()),
      fetch("/api/analytics/countries").then((r) => r.json()),
      fetch(`/api/analytics/usage?days=${days}`).then((r) => r.json()),
      fetch(`/api/analytics/events?days=${days}`).then((r) => r.json()),
      fetch("/api/analytics/onboarding").then((r) => r.json()),
      fetch("/api/analytics/trial").then((r) => r.json()),
    ]);
    setSummary(s);
    setGrowth(g);
    setActive(a);
    setMessages(m);
    setTiers(t);
    setPlatforms(p);
    setCountries(c);
    setUsage(u);
    setEvents(e);
    setOnboardingStats(ob);
    setTrialStats(tr);
  }, [days]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Analytics overview</p>
        </div>
        <div className="flex gap-1">
          {([
            ["7", "7d"],
            ["30", "30d"],
            ["90", "90d"],
            ["all", "All"],
          ] as [DateRange, string][]).map(([val, label]) => (
            <Button
              key={val}
              variant={range === val ? "default" : "outline"}
              size="sm"
              onClick={() => setRange(val)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Total Users"
          value={summary.totalUsers}
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
        />
        <SummaryCard
          title="Active Today"
          value={summary.activeToday}
          icon={<Activity className="h-4 w-4 text-muted-foreground" />}
        />
        <SummaryCard
          title="Messages Today"
          value={summary.messagesToday}
          icon={<MessageSquare className="h-4 w-4 text-muted-foreground" />}
        />
        <SummaryCard
          title="Paid Subscribers"
          value={summary.paidSubscribers}
          icon={<Crown className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">User Growth</CardTitle>
          </CardHeader>
          <CardContent>
            <GrowthChart data={growth} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Daily Active Users</CardTitle>
          </CardHeader>
          <CardContent>
            <ActiveUsersChart data={active} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Message Volume by Platform</CardTitle>
          </CardHeader>
          <CardContent>
            <MessagesChart data={messages} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Tier Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <TierPieChart data={tiers} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Platform Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <PlatformBarChart data={platforms} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Country Distribution
              <span className="text-muted-foreground font-normal ml-2">
                ({countries.length} {countries.length === 1 ? "country" : "countries"})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CountryBarChart data={countries} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Usage Counters</CardTitle>
          </CardHeader>
          <CardContent>
            {usage && <UsageChart data={usage} />}
          </CardContent>
        </Card>
      </div>

      {/* Country breakdown table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Users by Country</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Country</TableHead>
                <TableHead className="text-right">Users</TableHead>
                <TableHead className="text-right">% of Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(() => {
                const total = countries.reduce((sum, c) => sum + c.count, 0);
                if (countries.length === 0) {
                  return (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        No country data
                      </TableCell>
                    </TableRow>
                  );
                }
                return countries.map((c) => (
                  <TableRow key={c.country}>
                    <TableCell>
                      <Badge variant="outline">{formatCountry(c.country)}</Badge>
                      {c.country && c.country !== "Unknown" && c.country !== formatCountry(c.country) && (
                        <span className="text-muted-foreground text-xs ml-2">
                          {c.country}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {c.count.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {total > 0 ? ((c.count / total) * 100).toFixed(1) : "0.0"}%
                    </TableCell>
                  </TableRow>
                ));
              })()}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Top Events Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Top Analytics Events</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event Name</TableHead>
                <TableHead className="text-right">Count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((e) => (
                <TableRow key={e.eventName}>
                  <TableCell>
                    <Badge variant="outline">{e.eventName}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {e.count.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
              {events.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground">
                    No events in this period
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Separator />

      {/* Section: Onboarding Funnel */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Onboarding Funnel</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Where users are dropping off during sign-up. Incomplete users are the primary nurture target.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            title="Completed Onboarding"
            value={onboardingStats?.completed ?? 0}
            icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
            subtitle={onboardingStats ? `${onboardingStats.completionRate}% completion rate` : undefined}
          />
          <SummaryCard
            title="In Progress"
            value={onboardingStats?.inProgress ?? 0}
            icon={<Clock className="h-4 w-4 text-yellow-500" />}
            subtitle="Started but not finished"
          />
          <SummaryCard
            title="Not Started"
            value={onboardingStats?.notStarted ?? 0}
            icon={<XCircle className="h-4 w-4 text-muted-foreground" />}
            subtitle="Registered, step 0"
          />
          <SummaryCard
            title="Completion Rate"
            value={onboardingStats?.completionRate ?? 0}
            icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
            suffix="%"
            subtitle={`${onboardingStats?.total ?? 0} total users`}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Drop-off by Onboarding Step</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Step</TableHead>
                  <TableHead className="text-right">Users Stuck</TableHead>
                  <TableHead className="text-right">% of Incomplete</TableHead>
                  <TableHead className="text-right">% of All Users</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {onboardingStats && onboardingStats.dropoffByStep.length > 0 ? (
                  (() => {
                    const incompleteTotal = onboardingStats.inProgress + onboardingStats.notStarted;
                    return onboardingStats.dropoffByStep.map((row) => (
                      <TableRow key={row.step}>
                        <TableCell>
                          <Badge variant={row.step === 0 ? "secondary" : "outline"}>
                            {row.step === 0 ? "Step 0 — Not started" : `Step ${row.step}`}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {row.count.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {incompleteTotal > 0
                            ? ((row.count / incompleteTotal) * 100).toFixed(1)
                            : "0.0"}%
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {onboardingStats.total > 0
                            ? ((row.count / onboardingStats.total) * 100).toFixed(1)
                            : "0.0"}%
                        </TableCell>
                      </TableRow>
                    ));
                  })()
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                      {onboardingStats ? "All users have completed onboarding" : "Loading..."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Section: Free Trial Pipeline */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Free Trial Pipeline</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Monitor trial urgency and identify high-priority users to convert before trials expire.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <SummaryCard
            title="Active Trials"
            value={trialStats?.active ?? 0}
            icon={<Activity className="h-4 w-4 text-blue-500" />}
          />
          <SummaryCard
            title="Expiring in 3 Days"
            value={trialStats?.expiring3d ?? 0}
            icon={<Flame className="h-4 w-4 text-red-500" />}
            urgent={!!trialStats?.expiring3d}
          />
          <SummaryCard
            title="Expiring in 7 Days"
            value={trialStats?.expiring7d ?? 0}
            icon={<AlertTriangle className="h-4 w-4 text-yellow-500" />}
          />
          <SummaryCard
            title="Trial Expired"
            value={trialStats?.expired ?? 0}
            icon={<XCircle className="h-4 w-4 text-destructive" />}
            subtitle="Not converted"
          />
          <SummaryCard
            title="Converted to Paid"
            value={trialStats?.converted ?? 0}
            icon={<Crown className="h-4 w-4 text-green-500" />}
          />
          <SummaryCard
            title="High Engagement Free"
            value={trialStats?.highEngagementFree ?? 0}
            icon={<TrendingUp className="h-4 w-4 text-purple-500" />}
            subtitle=">5 msgs this week, still free"
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Urgent Action Required
              <span className="text-muted-foreground font-normal ml-2">
                Expiring soon or recently expired
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Onboarding</TableHead>
                  <TableHead className="text-right">Trial Ends</TableHead>
                  <TableHead className="text-right">Days Left</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trialStats && trialStats.urgentUsers.length > 0 ? (
                  trialStats.urgentUsers.map((u) => (
                    <TableRow
                      key={u.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/users/${u.id}`)}
                    >
                      <TableCell>
                        <div className="font-medium text-sm">{u.name}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{u.platform}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {u.country ? formatCountry(u.country) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        {u.onboardingComplete ? (
                          <Badge variant="default" className="text-xs">Done</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Incomplete</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {formatDate(u.trialEndsAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        {u.daysLeft > 0 ? (
                          <Badge
                            variant={u.daysLeft <= 3 ? "destructive" : "secondary"}
                            className="text-xs"
                          >
                            {u.daysLeft}d left
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">
                            Expired {Math.abs(u.daysLeft)}d ago
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                      {trialStats ? "No urgent trials right now" : "Loading..."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon,
  subtitle,
  suffix,
  urgent,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  subtitle?: string;
  suffix?: string;
  urgent?: boolean;
}) {
  return (
    <Card className={urgent ? "border-destructive/50" : undefined}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${urgent ? "text-destructive" : ""}`}>
          {value.toLocaleString()}{suffix}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}
