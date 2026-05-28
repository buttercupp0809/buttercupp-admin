import { NextRequest, NextResponse } from "next/server";
import { getAWSCosts } from "@/lib/aws";

export async function GET(req: NextRequest) {
  const period = (req.nextUrl.searchParams.get("period") || "current") as
    | "current"
    | "last"
    | "total";

  if (!["current", "last", "total"].includes(period)) {
    return NextResponse.json({ error: "Invalid period" }, { status: 400 });
  }

  try {
    const data = await getAWSCosts(period);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[AWS Costs]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
