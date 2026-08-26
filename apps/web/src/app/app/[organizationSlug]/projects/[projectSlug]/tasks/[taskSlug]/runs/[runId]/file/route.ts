import { NextResponse } from "next/server";
import { assertNeverExecutesUserCode } from "@agentforge/security";

import { getOptionalAuthenticatedUser } from "@/modules/auth/server/require-authenticated-user";
import { loadTaskManifest, readTaskFile } from "@/modules/tasks/server/file-content";
import { resolveTaskRunContext } from "@/modules/tasks/server/task-runs";

/**
 * The only way a file's bytes leave the server.
 *
 * It is scoped by construction: organization, project, task, and run all come from
 * the path, and the single query parameter is a package-relative file path that
 * must already appear in that run's manifest. There is no parameter for a storage
 * key, an artifact id, or a filesystem location, so there is nothing here that can
 * be widened into a general file endpoint.
 *
 * Anything a caller is not entitled to — another organization's project, a run
 * that does not contain the task, a path outside the task's scope — answers 404,
 * so the response never reveals that the resource exists.
 */

export const dynamic = "force-dynamic";

const NOT_FOUND = { error: "not-found" } as const;

function json(body: unknown, status: number, cacheControl: string): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": cacheControl,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      organizationSlug: string;
      projectSlug: string;
      taskSlug: string;
      runId: string;
    }>;
  },
): Promise<NextResponse> {
  assertNeverExecutesUserCode("apps/web task file route");

  // Authorization happens before any cache decision, and every response below is
  // marked private so a shared cache can never hold one tenant's file for another.
  const user = await getOptionalAuthenticatedUser();
  if (!user) {
    return json({ error: "unauthenticated" }, 401, "no-store");
  }

  const { organizationSlug, projectSlug, taskSlug, runId } = await params;
  const requestedPath = new URL(request.url).searchParams.get("path");
  if (requestedPath === null) {
    return json({ error: "invalid-path" }, 400, "no-store");
  }

  const context = await resolveTaskRunContext({
    organizationSlug,
    projectSlug,
    taskSlug,
    runNumber: runId,
  });
  if (!context) {
    return json(NOT_FOUND, 404, "no-store");
  }

  const manifest = await loadTaskManifest(context, context.siblingTaskRootPaths);
  const result = await readTaskFile(context, requestedPath, manifest);

  if (!result.ok) {
    const status = result.error === "invalid-path" ? 400 : 404;
    return json({ error: result.error }, status, "no-store");
  }

  // A completed run is pinned to an immutable artifact, so this body can never
  // change. Still private: the content belongs to one organization.
  const immutable =
    context.run.status === "succeeded" ? "private, max-age=3600, immutable" : "private, no-store";

  return json({ path: result.path, content: result.content }, 200, immutable);
}
