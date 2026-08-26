import { describe, expect, it } from "vitest";

import { mapAuthError } from "./errors";

describe("mapAuthError", () => {
  it("maps known provider messages", () => {
    expect(mapAuthError({ message: "Invalid login credentials" }, "fallback")).toBe(
      "Unable to sign in with those credentials.",
    );
    expect(mapAuthError({ message: "User already registered" }, "fallback")).toBe(
      "An account with this email already exists.",
    );
  });

  it("returns fallback for unknown errors", () => {
    expect(mapAuthError({ message: "weird internal detail" }, "Safe fallback")).toBe(
      "Safe fallback",
    );
    expect(mapAuthError(null, "Safe fallback")).toBe("Safe fallback");
  });
});
