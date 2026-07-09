import { cookies, headers } from "next/headers";
import { ResultsView, type ResultsResponse } from "./ResultsView";

export const dynamic = "force-dynamic";

async function getResults(days: number): Promise<ResultsResponse | null> {
  const cookieStore = await cookies();
  const headerStore = await headers();

  const host = headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") || "http";
  if (!host) return null;

  try {
    const res = await fetch(`${protocol}://${host}/api/paywall/results?days=${days}`, {
      headers: { cookie: cookieStore.toString() },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as ResultsResponse;
  } catch {
    return null;
  }
}

export default async function ResultsPage() {
  const initial = await getResults(14);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Paywall Results</h1>
        <p className="text-muted-foreground mt-1">
          Conversion by variant, from paywall_viewed through purchase. Significance is a
          two-proportion z-test vs control.
        </p>
      </div>

      <ResultsView initial={initial} />
    </div>
  );
}
