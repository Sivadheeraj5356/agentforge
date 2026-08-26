import { createHmac, timingSafeEqual } from "node:crypto";

export type StripeCheckoutSession = {
  readonly id: string;
  readonly url: string | null;
  readonly customer: string | null;
  readonly subscription: string | null;
};

function formBody(fields: Record<string, string>): string {
  return Object.entries(fields)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}

export function stripeSecretKey(): string | undefined {
  const value = process.env.STRIPE_SECRET_KEY?.trim();
  return value && value.length > 0 ? value : undefined;
}

export function stripePriceId(): string | undefined {
  const value = process.env.STRIPE_PRICE_ID?.trim();
  return value && value.length > 0 ? value : undefined;
}

export function stripeWebhookSecret(): string | undefined {
  const value = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  return value && value.length > 0 ? value : undefined;
}

export function stripeConfigured(): boolean {
  return Boolean(stripeSecretKey() && stripePriceId());
}

export function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!header) {
    return false;
  }
  const parts = Object.fromEntries(
    header.split(",").map((item) => {
      const [rawKey, ...rest] = item.split("=");
      return [(rawKey ?? "").trim(), rest.join("=")];
    }),
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) {
    return false;
  }
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > 300) {
    return false;
  }
  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`, "utf8").digest("hex");
  const actual = Buffer.from(signature, "utf8");
  const want = Buffer.from(expected, "utf8");
  if (actual.length !== want.length) {
    return false;
  }
  return timingSafeEqual(actual, want);
}

async function stripePost(
  secret: string,
  path: string,
  fields: Record<string, string>,
): Promise<Record<string, unknown>> {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formBody(fields),
  });
  const json: unknown = await response.json();
  if (!response.ok || typeof json !== "object" || json === null) {
    throw new Error("Stripe request failed.");
  }
  return json as Record<string, unknown>;
}

export async function createStripeCustomer(input: {
  readonly secret: string;
  readonly organizationId: string;
  readonly organizationSlug: string;
}): Promise<string> {
  const payload = await stripePost(input.secret, "customers", {
    "metadata[organization_id]": input.organizationId,
    "metadata[organization_slug]": input.organizationSlug,
  });
  const id = payload.id;
  if (typeof id !== "string" || !id.startsWith("cus_")) {
    throw new Error("Stripe customer id missing.");
  }
  return id;
}

export async function createStripeCheckoutSession(input: {
  readonly secret: string;
  readonly priceId: string;
  readonly customerId: string;
  readonly organizationId: string;
  readonly successUrl: string;
  readonly cancelUrl: string;
}): Promise<StripeCheckoutSession> {
  const payload = await stripePost(input.secret, "checkout/sessions", {
    mode: "subscription",
    customer: input.customerId,
    "line_items[0][price]": input.priceId,
    "line_items[0][quantity]": "1",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    client_reference_id: input.organizationId,
    "metadata[organization_id]": input.organizationId,
  });
  const id = payload.id;
  const url = payload.url;
  const customer = payload.customer;
  const subscription = payload.subscription;
  if (typeof id !== "string") {
    throw new Error("Stripe checkout session id missing.");
  }
  return {
    id,
    url: typeof url === "string" ? url : null,
    customer: typeof customer === "string" ? customer : null,
    subscription: typeof subscription === "string" ? subscription : null,
  };
}

export type StripeEvent = {
  readonly type: string;
  readonly data: { readonly object: Record<string, unknown> };
};

export function parseStripeEvent(payload: string): StripeEvent | null {
  try {
    const parsed: unknown = JSON.parse(payload);
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    if (typeof record.type !== "string") {
      return null;
    }
    const data = record.data;
    if (typeof data !== "object" || data === null) {
      return null;
    }
    const object = (data as Record<string, unknown>).object;
    if (typeof object !== "object" || object === null) {
      return null;
    }
    return { type: record.type, data: { object: object as Record<string, unknown> } };
  } catch {
    return null;
  }
}
