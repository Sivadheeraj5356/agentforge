import { describe, expect, it } from "vitest";

import { LANDING_HEADLINE, LANDING_PROVIDE_HEADING, marketingPlainText } from "./copy";

describe("landing copy", () => {
  it("leads with a benefit and skips slop plus competitor-clone framing", () => {
    expect(LANDING_HEADLINE).toMatch(/fixed it/i);
    expect(LANDING_PROVIDE_HEADING).toMatch(/provides/i);
    const text = marketingPlainText();
    expect(text).toMatch(/Private work environments/);
    expect(text).toMatch(/Orders API operations/);
    expect(text).toMatch(/EU payments incident/);
    expect(text).toMatch(/Checkout console clone/);
    expect(text).toMatch(/Private eval — stalled release train/);
    expect(text).toMatch(/Who it's for/);
    expect(text).toMatch(/Labs/);
    expect(text).toMatch(/Agent teams/);
    expect(text).not.toMatch(/Is Docs public/);
    expect(text).not.toMatch(/reimagine|empower|seamless|unlock|next-gen|revolutionize/i);
    expect(text).not.toMatch(/terminal-bench\s*4/i);
    expect(text).not.toMatch(/not a .+clone/i);
  });
});
