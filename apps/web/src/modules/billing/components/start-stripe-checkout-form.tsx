"use client";

import { useActionState, type ReactElement } from "react";
import { Button } from "@agentforge/ui";

import { startStripeCheckoutAction, type BillingActionResult } from "@/modules/billing/actions";

const initial: BillingActionResult | undefined = undefined;

export function StartStripeCheckoutForm({
  organizationSlug,
}: {
  organizationSlug: string;
}): ReactElement {
  const [state, action, pending] = useActionState(startStripeCheckoutAction, initial);
  return (
    <form action={action} className="flex max-w-md flex-col gap-3">
      <input type="hidden" name="organizationSlug" value={organizationSlug} />
      {state && !state.ok ? (
        <p role="alert" className="text-danger text-sm">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Opening Stripe…" : "Start Stripe test checkout"}
      </Button>
    </form>
  );
}
