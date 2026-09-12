"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { GrowthChart } from "@/components/charts/growth-chart";
import { ActiveUsersChart } from "@/components/charts/active-users-chart";
import { TierPieChart } from "@/components/charts/tier-pie-chart";
import { TokenUsageChart } from "@/components/charts/token-usage-chart";
import {
  Users,
  MessageSquare,
  Crown,
  Activity,
  ShieldAlert,
  Globe,
  TrendingUp,
} from "lucide-react";
import { formatCountry, formatDate } from "@/lib/utils";

type DateRange = "7" | "30" | "90" | "all";

export default function DashboardPage() {
  const router = useRouter();
  const [range, setRange] = useState<DateRange>("30");
  const [summary, setSummary] = useState({
    totalUsers: 0,
    activeToday: 0,
    messagesToday: 0,
    paidSubscribers: 0,
    pendingModeration: 0,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [growth, setGrowth] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [active, setActive] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [tiers, setTiers] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [countries, setCountries] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [tokens, setTokens] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [events, setEvents] = useState<any[]>([]);
  const [topConversionCountry, setTopConversionCountry] = useState<{ country: string; count: number }>({ country: "", count: 0 });

  const days = range === "all" ? "365" : range;

  const fetchAll = useCallback(async () => {
    const [s, g, a, t, c, tk, e, conv] = await Promise.all([
      fetch("/api/analytics/summary").then((r) => r.json()),
      fetch(`/api/analytics/growth?days=${days}`).then((r) => r.json()),
      fetch(`/api/analytics/active?days=${days}`).then((r) => r.json()),
      fetch("/api/analytics/tiers").then((r) => r.json()),
      fetch("/api/analytics/countries").then((r) => r.json()),
      fetch("/api/analytics/tokens").then((r) => r.json()),
      fetch("/api/analytics/events").then((r) => r.json()),
      fetch("/api/analytics/countries/conversions").then((r) => r.json()),
    ]);
    setSummary(s);
    setGrowth(g);
    setActive(a);
    setTiers(t);
    setCountries(c);
    setTokens(tk);
    setEvents(e);
    setTopConversionCountry(conv);
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <SummaryCard
          title="Total Users"
          value={summary.totalUsers}
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
        />
        <SummaryCard
          title="Active Today"
          value={summary.activeToday}
          icon={<Activity className="h-4 w-4 text-muted-foreground" />}
          subtitle="Conversations updated today"
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
        <SummaryCard
          title="Pending Moderation"
          value={summary.pendingModeration}
          icon={<ShieldAlert className="h-4 w-4 text-muted-foreground" />}
          subtitle={
            summary.pendingModeration > 0 ? (
              <button
                className="text-xs text-blue-500 hover:underline"
                onClick={() => router.push("/moderation")}
              >
                Review now
              </button>
            ) : undefined
          }
          urgent={summary.pendingModeration > 0}
        />
      </div>

      {/* Country Highlights */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Top User Country</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {countries[0] ? formatCountry(countries[0].country) : "—"}
            </div>
            {countries[0] && (
              <p className="text-xs text-muted-foreground mt-1">
                {countries[0].count.toLocaleString()} users
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Top Conversion Country</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {topConversionCountry.country ? formatCountry(topConversionCountry.country) : "—"}
            </div>
            {topConversionCountry.country && (
              <p className="text-xs text-muted-foreground mt-1">
                {topConversionCountry.count.toLocaleString()} paid subscribers
              </p>
            )}
          </CardContent>
        </Card>
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
            <CardTitle className="text-sm">Tier Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <TierPieChart data={tiers} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Token Usage by Reason (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <TokenUsageChart data={tokens} />
          </CardContent>
        </Card>
      </div>

      {/* Country breakdown table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Users by Country
            <span className="text-muted-foreground font-normal ml-2">
              ({countries.length} {countries.length === 1 ? "country" : "countries"})
            </span>
          </CardTitle>
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
                <TableRow key={e.name}>
                  <TableCell>
                    <Badge variant="outline">{e.name}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {e.count.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
              {events.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground">
                    No events recorded
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
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
  subtitle?: React.ReactNode;
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
