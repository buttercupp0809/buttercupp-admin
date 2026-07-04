import { cookies, headers } from "next/headers";
import { FunnelView, type FunnelResponse } from "./FunnelView";

export const dynamic = "force-dynamic";

async function getFunnel(rangeDays: number): Promise<FunnelResponse | null> {
  const cookieStore = await cookies();
  const headerStore = await headers();

  const host = headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") || "http";
  if (!host) return null;

  try {
    const res = await fetch(
      `${protocol}://${host}/api/funnel?rangeDays=${rangeDays}`,
      {
        headers: { cookie: cookieStore.toString() },
        cache: "no-store",
      }
    );
    if (!res.ok) return null;
    return (await res.json()) as FunnelResponse;
  } catch {
    return null;
  }
}

export default async function FunnelPage() {
  const initial = await getFunnel(14);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Conversion Funnel</h1>
          <p className="text-muted-foreground mt-1">
            Lead to purchase conversion, sliced by variant and campaign
          </p>
        </div>
        <span className="text-xs text-muted-foreground rounded-md border px-2 py-1">
          Range: 14d
        </span>
      </div>

      <FunnelView initial={initial} />
    </div>
  );
}
