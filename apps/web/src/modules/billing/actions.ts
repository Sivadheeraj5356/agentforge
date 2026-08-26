import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOrganizationBySlug } from "@/modules/organizations/server/access";
import { canManageProjects } from "@/modules/projects/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createStripeCheckoutSession,
  createStripeCustomer,
  stripeConfigured,
  stripePriceId,
  stripeSecretKey,
} from "@/modules/billing/server/stripe";

export type BillingActionResult = { ok: true; message: string } | { ok: false; error: string };

export async function startStripeCheckoutAction(
  _prev: BillingActionResult | undefined,
  formData: FormData,
): Promise<BillingActionResult> {
  const organizationSlug = String(formData.get("organizationSlug") ?? "");
  const organization = await requireOrganizationBySlug(organizationSlug);
  if (!canManageProjects(organization.role)) {
    return { ok: false, error: "Owner or admin required." };
  }
  const secret = stripeSecretKey();
  const priceId = stripePriceId();
  if (!secret || !priceId || !stripeConfigured()) {
    return { ok: false, error: "Stripe test mode is not configured." };
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://127.0.0.1:3000";
  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("billing_customers")
    .select("stripe_customer_id")
    .eq("organization_id", organization.id)
    .maybeSingle();
  let customerId = existing?.stripe_customer_id;
  if (!customerId) {
    customerId = await createStripeCustomer({
      secret,
      organizationId: organization.id,
      organizationSlug: organization.slug,
    });
    const { error } = await supabase.from("billing_customers").insert({
      organization_id: organization.id,
      stripe_customer_id: customerId,
    });
    if (error) {
      return { ok: false, error: "Billing customer could not be saved." };
    }
  }
  const session = await createStripeCheckoutSession({
    secret,
    priceId,
    customerId,
    organizationId: organization.id,
    successUrl: `${appUrl}/app/${organization.slug}/settings?billing=success`,
    cancelUrl: `${appUrl}/app/${organization.slug}/settings?billing=cancel`,
  });
  if (!session.url) {
    return { ok: false, error: "Stripe Checkout did not return a URL." };
  }
  revalidatePath(`/app/${organization.slug}/settings`);
  redirect(session.url);
}
