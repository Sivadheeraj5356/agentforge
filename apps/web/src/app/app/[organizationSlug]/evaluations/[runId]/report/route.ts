import { NextResponse } from "next/server";
import { assertNeverExecutesUserCode } from "@agentforge/security";

import { buildEvaluationJsonReport } from "@/modules/evaluations/server/report";
import { requireOrganizationBySlug } from "@/modules/organizations/server/access";

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationSlug: string; runId: string }> },
): Promise<Response> {
  assertNeverExecutesUserCode("apps/web evaluation JSON report");
  const { organizationSlug, runId } = await context.params;
  const organization = await requireOrganizationBySlug(organizationSlug);
  const report = await buildEvaluationJsonReport(organization.id, runId);
  if (!report) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(report, {
    headers: {
      "Content-Disposition": `attachment; filename="agentforge-eval-${runId}.json"`,
    },
  });
}
