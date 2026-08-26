import type { ReactElement } from "react";
import { assertNeverExecutesUserCode } from "@agentforge/security";

import {
  TaskInspectorPage,
  type InspectorSearchParams,
} from "@/modules/tasks/components/task-inspector-page";

/** The task at its most recent validation run. */
export default async function TaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationSlug: string; projectSlug: string; taskSlug: string }>;
  searchParams: Promise<InspectorSearchParams>;
}): Promise<ReactElement> {
  assertNeverExecutesUserCode("apps/web task inspector");
  const [{ organizationSlug, projectSlug, taskSlug }, query] = await Promise.all([
    params,
    searchParams,
  ]);

  return (
    <TaskInspectorPage
      organizationSlug={organizationSlug}
      projectSlug={projectSlug}
      taskSlug={taskSlug}
      searchParams={query}
    />
  );
}
