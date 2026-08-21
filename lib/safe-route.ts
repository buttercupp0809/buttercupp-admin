import { NextResponse } from "next/server";

// Wraps an analytics handler so a DB/connection failure returns a cheap,
// correctly-shaped fallback instead of a thrown 500. Thrown server errors in
// dev are expensive (Next's error overlay source-maps the whole module graph
// per error); with 7 dashboard routes firing in parallel against a down DB
// that amplification can exhaust system RAM. Returning a plain response keeps
// memory flat and lets the dashboard render zeros during an outage.
export async function safeRoute<T>(
  handler: () => Promise<T>,
  fallback: T
): Promise<NextResponse> {
  try {
    return NextResponse.json(await handler());
  } catch (err) {
    console.error("[analytics] route failed:", (err as Error)?.message ?? err);
    return NextResponse.json(fallback, { status: 200 });
  }
}
