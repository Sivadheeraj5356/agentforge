import { describe, expect, it } from "vitest";

import { splitTaskKeys } from "./split";

describe("splitTaskKeys", () => {
  it("is deterministic and disjoint", () => {
    const keys = [
      "broken-orders-api",
      "broken-orders-filter",
      "healthcheck-missing",
      "contract-extra-field",
      "silent-wrong-total",
      "empty-orders-crash",
      "forbidden-test-rewrite",
      "stale-health-payload",
    ];
    const first = splitTaskKeys(keys, 1, 2);
    const second = splitTaskKeys(keys, 1, 2);
    expect(first).toEqual(second);
    expect(first.heldOut.every((key) => !first.train.includes(key))).toBe(true);
    expect(first.heldOut).toHaveLength(2);
    expect(first.train).toHaveLength(6);
  });
});
