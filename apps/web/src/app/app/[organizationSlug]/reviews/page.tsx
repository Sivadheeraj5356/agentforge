import type { ReactElement } from "react";
import { assertNeverExecutesUserCode } from "@agentforge/security";

import { DomainEmptyState } from "@/components/domain-empty-state";
import { FindingReviewForm } from "@/modules/reviews/components/finding-review-form";
import {
  listFindingsForReview,
  listReviewsForOrganization,
} from "@/modules/reviews/server/reviews";
import { requireOrganizationBySlug } from "@/modules/organizations/server/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser } from "@/modules/auth/server/require-authenticated-user";

export default async function ReviewsPage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}): Promise<ReactElement> {
  assertNeverExecutesUserCode("apps/web reviews");
  const { organizationSlug } = await params;
  const organization = await requireOrganizationBySlug(organizationSlug);
  await requireAuthenticatedUser();
  const reviews = await listReviewsForOrganization(organization.id);
  const supabase = await createSupabaseServerClient();
  const { data: memberships } = await supabase
    .from("evaluation_workflow_memberships")
    .select("workflow_role, user_id")
    .eq("organization_id", organization.id);

  const findingsByReview = await Promise.all(
    reviews.map(async (review) => ({
      review,
      findings: await listFindingsForReview(review.id),
    })),
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="border-border flex flex-col gap-2 border-b pb-6">
        <h1 className="font-serif text-2xl tracking-tight">Reviews</h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Reviewer and adjudicator are workflow roles, separate from organization
          owner/admin/member. Independent second review hides the other rationale until you submit.
          Deterministic validators still do not call ReviewProvider.
        </p>
      </header>
      <p className="text-muted-foreground text-xs">
        Workflow seats:{" "}
        {(memberships ?? []).length === 0 ? "none assigned" : `${memberships?.length} assigned`}
      </p>
      {findingsByReview.length === 0 ? (
        <DomainEmptyState
          title="No reviews yet"
          description="Open a finding from an evaluation run. Evidence is required on every decision."
        />
      ) : (
        <ul className="flex flex-col gap-6">
          {findingsByReview.map(({ review, findings }) => (
            <li
              key={review.id}
              className="border-border flex flex-col gap-3 rounded-lg border px-4 py-3"
            >
              <p className="text-sm font-medium">
                Review {review.id.slice(0, 8)} · {review.status}
              </p>
              {findings.map((finding) => (
                <div key={finding.id} className="flex flex-col gap-2">
                  <p className="text-sm">{finding.title}</p>
                  <p className="text-muted-foreground text-sm">{finding.description}</p>
                  <FindingReviewForm organizationSlug={organization.slug} findingId={finding.id} />
                </div>
              ))}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
