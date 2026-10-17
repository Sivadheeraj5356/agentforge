import { NextResponse } from "next/server";
import { Sandbox } from "@vercel/sandbox";

export const runtime = "nodejs";
export const maxDuration = 60;

/** On-demand tail of a grader sandbox's /tmp/boot.log, same auth as the drain. */
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "Cron is not configured." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const name = new URL(request.url).searchParams.get("name")?.trim();
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  try {
    const sandbox = await Sandbox.get({ name });
    const tail = await sandbox.runCommand({ cmd: "tail", args: ["-c", "6000", "/tmp/boot.log"] });
    return NextResponse.json({ name, log: await tail.stdout() });
  } catch (error) {
    return NextResponse.json(
      { name, error: error instanceof Error ? error.message : String(error) },
      { status: 502 },
    );
  }
}
