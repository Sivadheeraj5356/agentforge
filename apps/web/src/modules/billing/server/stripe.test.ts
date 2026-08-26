import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { parseStripeEvent, verifyStripeSignature } from "./stripe";

describe("verifyStripeSignature", () => {
  it("accepts a timely v1 signature", () => {
    const secret = "whsec_test";
    const payload = "{\"id\":\"evt_1\"}";
    const timestamp = 1_700_000_000;
    const signature = createHmac("sha256", secret).update(`${timestamp}.${payload}`, "utf8").digest("hex");
    expect(
      verifyStripeSignature(payload, `t=${timestamp},v1=${signature}`, secret, timestamp),
    ).toBe(true);
  });

  it("rejects a missing or stale signature", () => {
    expect(verifyStripeSignature("{}", null, "whsec_test")).toBe(false);
    const secret = "whsec_test";
    const payload = "{}";
    const timestamp = 1;
    const signature = createHmac("sha256", secret).update(`${timestamp}.${payload}`, "utf8").digest("hex");
    expect(
      verifyStripeSignature(payload, `t=${timestamp},v1=${signature}`, secret, 1_700_000_000),
    ).toBe(false);
  });
});

describe("parseStripeEvent", () => {
  it("reads type and object", () => {
    const event = parseStripeEvent(
      JSON.stringify({
        type: "checkout.session.completed",
        data: { object: { customer: "cus_1" } },
      }),
    );
    expect(event?.type).toBe("checkout.session.completed");
    expect(event?.data.object.customer).toBe("cus_1");
  });
});
