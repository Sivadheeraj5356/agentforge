import { NextResponse } from "next/server";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import {
  parseStripeEvent,
  stripeWebhookSecret,
  verifyStripeSignature,
} from "@/modules/billing/server/stripe";

export const runtime = "nodejs";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function POST(request: Request): Promise<Response> {
  const secret = stripeWebhookSecret();
  if (!secret) {
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 503 });
  }
  const payload = await request.text();
  if (
    !verifyStripeSignature(payload, request.headers.get("stripe-signature"), secret)
  ) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }
  const event = parseStripeEvent(payload);
  if (!event) {
    return NextResponse.json({ error: "Invalid event." }, { status: 400 });
  }
  const object = event.data.object;
  const supabase = createSupabaseServiceRoleClient();

  if (event.type === "checkout.session.completed") {
    const organizationId = asString(object.client_reference_id) ?? asString(
      (object.metadata as Record<string, unknown> | undefined)?.organization_id,
    );
    const customerId = asString(object.customer);
    const subscriptionId = asString(object.subscription);
    if (!organizationId || !customerId) {
      return NextResponse.json({ received: true });
    }
    await supabase.from("billing_customers").upsert(
      {
        organization_id: organizationId,
        stripe_customer_id: customerId,
      },
      { onConflict: "organization_id" },
    );
    if (subscriptionId) {
      const { data: customer } = await supabase
        .from("billing_customers")
        .select("id")
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (customer) {
        await supabase.from("billing_subscriptions").upsert(
          {
            organization_id: organizationId,
            billing_customer_id: customer.id,
            stripe_subscription_id: subscriptionId,
            status: "active",
          },
          { onConflict: "organization_id" },
        );
      }
    }
  }

  if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const subscriptionId = asString(object.id);
    const status = asString(object.status);
    if (subscriptionId && status) {
      await supabase
        .from("billing_subscriptions")
        .update({ status })
        .eq("stripe_subscription_id", subscriptionId);
    }
  }

  return NextResponse.json({ received: true });
}
