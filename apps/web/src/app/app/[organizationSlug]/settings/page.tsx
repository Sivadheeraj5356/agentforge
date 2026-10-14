import type { ReactElement } from "react";
import { Button, Label } from "@agentforge/ui";
import { assertNeverExecutesUserCode } from "@agentforge/security";

import { WorkspaceShortcutLinks } from "@/components/workspace-shortcuts";
import { assignWorkflowRoleAction } from "@/modules/reviews/actions";
import { CreateWebhookForm } from "@/modules/lab/components/create-webhook-form";
import { StartStripeCheckoutForm } from "@/modules/billing/components/start-stripe-checkout-form";
import { requireOrganizationBySlug } from "@/modules/organizations/server/access";
import { canManageProjects } from "@/modules/projects/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { stripeConfigured } from "@/modules/billing/server/stripe";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}): Promise<ReactElement> {
  assertNeverExecutesUserCode("apps/web settings");
  const { organizationSlug } = await params;
  const organization = await requireOrganizationBySlug(organizationSlug);
  const canAssign = canManageProjects(organization.role);
  const stripeReady = stripeConfigured();
  const supabase = await createSupabaseServerClient();
  const { data: members } = await supabase
    .from("organization_memberships")
    .select("user_id, role")
    .eq("organization_id", organization.id);
  const { data: subscription } = await supabase
    .from("billing_subscriptions")
    .select("status, stripe_subscription_id")
    .eq("organization_id", organization.id)
    .maybeSingle();

  return (
    <div className="flex flex-col gap-6">
      <header className="border-border flex flex-col gap-2 border-b pb-6">
        <h1 className="font-serif text-2xl tracking-tight">Settings</h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Workflow reviewer and adjudicator roles are not org owner/admin/member. Assign them here.
        </p>
        <WorkspaceShortcutLinks organizationSlug={organization.slug} ids={["lab"]} />
      </header>
      {canAssign ? (
        <form action={assignWorkflowRoleAction} className="flex max-w-md flex-col gap-3">
          <input type="hidden" name="organizationSlug" value={organization.slug} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="workflow-user">Member</Label>
            <select
              id="workflow-user"
              name="userId"
              className="border-border bg-surface h-(--height-control) rounded-md border px-3 text-sm"
              required
            >
              {(members ?? []).map((member) => (
                <option key={member.user_id} value={member.user_id}>
                  {member.user_id.slice(0, 8)} · {member.role}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="workflow-role">Workflow role</Label>
            <select
              id="workflow-role"
              name="workflowRole"
              className="border-border bg-surface h-(--height-control) rounded-md border px-3 text-sm"
              required
            >
              <option value="reviewer">Reviewer</option>
              <option value="adjudicator">Adjudicator</option>
            </select>
          </div>
          <Button type="submit">Assign workflow role</Button>
        </form>
      ) : (
        <p className="text-muted-foreground text-sm">
          Owner or admin required to assign workflow roles.
        </p>
      )}
      {canAssign ? <CreateWebhookForm organizationSlug={organization.slug} /> : null}

      <section aria-labelledby="billing-heading" className="flex max-w-md flex-col gap-3">
        <h2 id="billing-heading" className="font-serif text-lg tracking-tight">
          Billing
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Stripe test mode only. A paid row is org metadata for a future gate. Local evaluation does
          not require a subscription.
        </p>
        {!stripeReady ? (
          <p className="text-muted-foreground text-sm">Stripe test mode is not configured.</p>
        ) : canAssign ? (
          <StartStripeCheckoutForm organizationSlug={organization.slug} />
        ) : (
          <p className="text-muted-foreground text-sm">
            Owner or admin required to start checkout.
          </p>
        )}
        {subscription ? (
          <p className="text-muted-foreground font-mono text-xs">status {subscription.status}</p>
        ) : (
          <p className="text-muted-foreground text-sm">No subscription row.</p>
        )}
      </section>
    </div>
  );
}
