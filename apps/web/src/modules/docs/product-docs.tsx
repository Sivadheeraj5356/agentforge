import type { ReactElement } from "react";

import { DocsShell } from "./docs-shell";
import type { DocsSection } from "./types";

export function ProductDocs({
  section,
  basePath,
  workspaceHref,
}: {
  section: DocsSection;
  basePath: string;
  workspaceHref?: string;
}): ReactElement {
  return <DocsShell section={section} basePath={basePath} workspaceHref={workspaceHref} />;
}
