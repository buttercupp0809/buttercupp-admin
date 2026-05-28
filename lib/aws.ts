import {
  CostExplorerClient,
  GetCostAndUsageCommand,
} from "@aws-sdk/client-cost-explorer";

const client = new CostExplorerClient({ region: "us-east-1" });

interface ServiceCost {
  service: string;
  cost: number;
}

interface CostData {
  services: ServiceCost[];
  total: number;
  creditsRemaining: number;
  period: { start: string; end: string };
}

let cache: Map<string, { data: CostData; ts: number }> = new Map();
const CACHE_TTL = 3600_000;

export async function getAWSCosts(
  period: "current" | "last" | "total"
): Promise<CostData> {
  const cached = cache.get(period);
  if (cached && cached.ts > Date.now() - CACHE_TTL) return cached.data;

  const now = new Date();
  let start: string;
  let end: string;

  if (period === "current") {
    start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    end = now.toISOString().slice(0, 10);
  } else if (period === "last") {
    const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    start = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-01`;
    end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  } else {
    start = "2026-04-01";
    end = now.toISOString().slice(0, 10);
  }

  // Cost Explorer requires start < end
  if (start >= end) {
    end = new Date(new Date(start).getTime() + 86400000)
      .toISOString()
      .slice(0, 10);
  }

  const cmd = new GetCostAndUsageCommand({
    TimePeriod: { Start: start, End: end },
    Granularity: "MONTHLY",
    Metrics: ["UnblendedCost"],
    GroupBy: [{ Type: "DIMENSION", Key: "SERVICE" }],
  });

  const result = await client.send(cmd);

  const serviceMap = new Map<string, number>();
  let total = 0;

  for (const period of result.ResultsByTime || []) {
    for (const group of period.Groups || []) {
      const svc = group.Keys?.[0] || "Unknown";
      const amount = parseFloat(
        group.Metrics?.UnblendedCost?.Amount || "0"
      );
      serviceMap.set(svc, (serviceMap.get(svc) || 0) + amount);
      total += amount;
    }
  }

  const services = [...serviceMap.entries()]
    .map(([service, cost]) => ({ service, cost: Math.round(cost * 100) / 100 }))
    .sort((a, b) => b.cost - a.cost);

  const creditTotal = parseFloat(process.env.AWS_CREDIT_TOTAL || "1000");

  // For credits remaining, always calculate from total all-time spend
  let allTimeTotal = total;
  if (period !== "total") {
    const totalData = await getAWSCosts("total");
    allTimeTotal = totalData.total;
  }

  const data: CostData = {
    services,
    total: Math.round(total * 100) / 100,
    creditsRemaining: Math.round((creditTotal - allTimeTotal) * 100) / 100,
    period: { start, end },
  };

  cache.set(period, { data, ts: Date.now() });
  return data;
}
