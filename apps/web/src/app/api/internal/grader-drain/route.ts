import { NextResponse } from "next/server";

import { launchGraderSandbox } from "@/modules/grader/sandbox";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Vercel Cron entry point (daily on Hobby): drains any stale queued
 * evaluations. Vercel sends Authorization: Bearer $CRON_SECRET when the
 * CRON_SECRET env var is set; requests without it are rejected.
 */
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "Cron is not configured." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const result = await launchGraderSandbox("cron");
  return NextResponse.json(result, { status: result.launched ? 200 : 500 });
}
