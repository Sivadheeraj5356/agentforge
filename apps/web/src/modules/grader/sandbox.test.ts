import { beforeEach, describe, expect, it, vi } from "vitest";

const afterMock = vi.hoisted(() => vi.fn());
const createMock = vi.hoisted(() => vi.fn());
const runCommandMock = vi.hoisted(() => vi.fn());

vi.mock("next/server", () => ({ after: afterMock }));

vi.mock("@vercel/sandbox", () => ({
  Sandbox: { create: createMock },
}));

import {
  graderAllowDomains,
  graderBootstrapScript,
  graderSandboxEnv,
  launchGraderSandbox,
  supabaseHost,
} from "./sandbox";

const BASE_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "https://mzkievjmtexqduqxhmcm.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-key",
};

beforeEach(() => {
  afterMock.mockReset();
  createMock.mockReset();
  runCommandMock.mockReset();
});

describe("supabaseHost", () => {
  it("extracts the project host", () => {
    expect(supabaseHost("https://mzkievjmtexqduqxhmcm.supabase.co")).toBe(
      "mzkievjmtexqduqxhmcm.supabase.co",
    );
  });
});

describe("graderAllowDomains", () => {
  it("allowlists Supabase, PyPI, GitHub and Docker Hub only", () => {
    const domains = graderAllowDomains(BASE_ENV.NEXT_PUBLIC_SUPABASE_URL as string);
    expect(domains).toContain("mzkievjmtexqduqxhmcm.supabase.co");
    expect(domains).toContain("pypi.org");
    expect(domains).toContain("registry-1.docker.io");
    expect(domains.some((d) => d === "*")).toBe(false);
  });
});

describe("graderSandboxEnv", () => {
  it("keeps the isolated provider and never enables fakes", () => {
    const env = graderSandboxEnv({ ...BASE_ENV } as unknown as NodeJS.ProcessEnv);
    expect(env.SANDBOX_PROVIDER).toBe("isolated");
    expect(env.ALLOW_FAKE).toBe("false");
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe("service-key");
  });

  it("passes model keys through only when configured", () => {
    expect(graderSandboxEnv({ ...BASE_ENV } as unknown as NodeJS.ProcessEnv)).not.toHaveProperty(
      "OPENAI_API_KEY",
    );
    expect(
      graderSandboxEnv({ ...BASE_ENV, OPENAI_API_KEY: "sk-test" } as unknown as NodeJS.ProcessEnv)
        .OPENAI_API_KEY,
    ).toBe("sk-test");
  });

  it("passes a server-configured BYO command without adding a default", () => {
    expect(graderSandboxEnv({ ...BASE_ENV } as unknown as NodeJS.ProcessEnv)).not.toHaveProperty(
      "AGENTFORGE_BYO_CMD",
    );
    expect(
      graderSandboxEnv({
        ...BASE_ENV,
        AGENTFORGE_BYO_CMD: "python /opt/byo/agent.py",
      } as unknown as NodeJS.ProcessEnv).AGENTFORGE_BYO_CMD,
    ).toBe("python /opt/byo/agent.py");
  });

  it("refuses to launch without the service-role key", () => {
    expect(() =>
      graderSandboxEnv({
        NEXT_PUBLIC_SUPABASE_URL: BASE_ENV.NEXT_PUBLIC_SUPABASE_URL,
      } as unknown as NodeJS.ProcessEnv),
    ).toThrow();
  });
});

describe("graderBootstrapScript", () => {
  it("drains with the existing worker and no credential echo", () => {
    const script = graderBootstrapScript();
    expect(script).toContain("python -m evaluator worker");
    expect(script).toContain("docker build");
    expect(script).not.toContain("service-key");
  });
});

describe("launchGraderSandbox", () => {
  it("creates a disposable microVM and starts the drain detached", async () => {
    createMock.mockResolvedValue({ name: "grader-1", runCommand: runCommandMock });
    const original = { ...process.env };
    Object.assign(process.env, BASE_ENV);
    try {
      const result = await launchGraderSandbox("enqueue");
      expect(result).toEqual({ launched: true, sandboxName: "grader-1", reason: "enqueue" });
      expect(afterMock).toHaveBeenCalledWith(expect.any(Function));
      const createArgs = createMock.mock.calls[0]![0]!;
      expect(createArgs.persistent).toBe(false);
      expect(createArgs.networkPolicy.allow).toContain("mzkievjmtexqduqxhmcm.supabase.co");
      expect(runCommandMock).toHaveBeenCalledWith(
        expect.objectContaining({ sudo: true, detached: true }),
      );
    } finally {
      process.env = original;
    }
  });

  it("reports failure without throwing", async () => {
    createMock.mockRejectedValue(new Error("quota"));
    Object.assign(process.env, BASE_ENV);
    const result = await launchGraderSandbox("cron");
    expect(result.launched).toBe(false);
    if (!result.launched) {
      expect(result.error).toBe("quota");
    }
  });
});
