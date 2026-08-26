import { describe, expect, it, vi } from "vitest";

import { logServerEvent } from "./server-log";

describe("logServerEvent", () => {
  it("emits JSON with a correlation id and no raw secrets", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const correlationId = logServerEvent({
      level: "info",
      message: "project created Bearer sk-abcdefghijklmnopqrstuvwxyz",
      action: "project.created",
    });

    expect(correlationId.length).toBeGreaterThan(8);
    expect(spy).toHaveBeenCalledTimes(1);
    const line = spy.mock.calls[0]?.[0];
    expect(typeof line).toBe("string");
    const parsed = JSON.parse(String(line)) as { correlationId: string; message: string };
    expect(parsed.correlationId).toBe(correlationId);
    expect(parsed.message).not.toMatch(/sk-abcdefghijklmnopqrstuvwxyz/);
    spy.mockRestore();
  });
});
