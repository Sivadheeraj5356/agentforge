import type { ReactElement } from "react";
import { assertNeverExecutesUserCode } from "@agentforge/security";

import {
  TaskInspectorPage,
  type InspectorSearchParams,
} from "@/modules/tasks/components/task-inspector-page";

/**
 * One historical run of a task. The `runId` segment carries the per-project run
 * number, not the row's UUID: runs are cited the way a reviewer says them out
 * loud, and the internal identifier never leaves the server.
 *
 * Runs are immutable, so this renders the same inspector with that run's own
 * findings, file manifest, and provenance.
 */
export default async function TaskRunPage({
  params,
  searchParams,
}: {
  params: Promise<{
    organizationSlug: string;
    projectSlug: string;
    taskSlug: string;
    runId: string;
  }>;
  searchParams: Promise<InspectorSearchParams>;
}): Promise<ReactElement> {
  assertNeverExecutesUserCode("apps/web task run inspector");
  const [{ organizationSlug, projectSlug, taskSlug, runId }, query] = await Promise.all([
    params,
    searchParams,
  ]);

  return (
    <TaskInspectorPage
      organizationSlug={organizationSlug}
      projectSlug={projectSlug}
      taskSlug={taskSlug}
      runNumber={runId}
      searchParams={query}
    />
  );
}
