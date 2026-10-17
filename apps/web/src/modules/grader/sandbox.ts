import { Sandbox } from "@vercel/sandbox";

/**
 * Automatic grading on Vercel Sandbox.
 *
 * Each launch boots a disposable Firecracker microVM, installs Docker in it,
 * clones this repository, builds the eval image and drains the Supabase
 * evaluation queue with the existing `isolated` (docker run --network none)
 * provider. Untrusted submission code therefore runs inside a real Docker
 * container with no network and no credentials - exactly the boundary the
 * GitHub Actions worker enforces - while the microVM itself is restricted to
 * an egress allowlist (Supabase, PyPI, GitHub, Docker Hub, Ubuntu archives).
 * The Supabase service-role key only exists in the worker VM's environment;
 * it is never passed to submission containers.
 */

const GRADER_REPO_URL = "https://github.com/Sivadheeraj5356/agentforge.git";
const GRADER_SANDBOX_TIMEOUT_MS = 25 * 60 * 1000;
const GRADER_DRAIN_BUDGET_SECONDS = 780;
const EVAL_IMAGE = "agentforge-eval-python:3.12";

/** Package, registry and repo hosts the worker VM needs; nothing else. */
const STATIC_ALLOW_DOMAINS = [
  "pypi.org",
  "files.pythonhosted.org",
  "github.com",
  "codeload.github.com",
  "objects.githubusercontent.com",
  "auth.docker.io",
  "registry-1.docker.io",
  "production.cloudflare.docker.com",
  "archive.ubuntu.com",
  "security.ubuntu.com",
] as const;

export function supabaseHost(url: string): string {
  const host = new URL(url).hostname;
  if (!host) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL has no host");
  }
  return host;
}

export function graderAllowDomains(supabaseUrl: string): string[] {
  return [supabaseHost(supabaseUrl), ...STATIC_ALLOW_DOMAINS];
}

const BOOTSTRAP_LINES = [
  "set -euo pipefail",
  "export DEBIAN_FRONTEND=noninteractive",
  "apt-get update -qq",
  "apt-get install -y -qq --no-install-recommends docker.io git python3 python3-venv ca-certificates",
  "nohup dockerd >/tmp/dockerd.log 2>&1 &",
  "for i in $(seq 1 60); do docker info >/dev/null 2>&1 && break; sleep 1; done",
  "docker info >/dev/null",
  'git clone --depth 1 "$GRADER_REPO_URL" /opt/agentforge',
  "cd /opt/agentforge",
  'docker build -q -t "$AGENTFORGE_EVAL_IMAGE" -f services/evaluator/docker/eval-python.Dockerfile . >/dev/null',
  "python3 -m venv /opt/venv",
  "/opt/venv/bin/pip install --quiet --disable-pip-version-check -e services/evaluator",
  "idle=0",
  "end=$((SECONDS + GRADER_DRAIN_BUDGET_SECONDS))",
  "while [ $SECONDS -lt $end ]; do",
  "  /opt/venv/bin/python -m evaluator worker > /tmp/w.out 2>&1 || true",
  "  out=$(tail -1 /tmp/w.out)",
  '  echo "drain: $out"',
  '  if [ "$out" = "idle" ]; then idle=$((idle+1)); else idle=0; fi',
  '  [ "$idle" -ge 3 ] && break',
  "  sleep 2",
  "done",
  "echo GRADER_DRAIN_DONE",
];

export function graderBootstrapScript(): string {
  return BOOTSTRAP_LINES.join("\n");
}

const PASSTHROUGH_MODEL_ENV = [
  "OPENAI_BASE_URL",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_MODEL",
  "AGENTFORGE_HARBOR_MODEL",
] as const;

export function graderSandboxEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase server env is not configured for the grader");
  }
  const out: Record<string, string> = {
    GRADER_REPO_URL,
    GRADER_DRAIN_BUDGET_SECONDS: String(GRADER_DRAIN_BUDGET_SECONDS),
    SUPABASE_URL: supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
    SANDBOX_PROVIDER: "isolated",
    ALLOW_FAKE: "false",
    AGENTFORGE_EVAL_IMAGE: EVAL_IMAGE,
    AGENTFORGE_FIXTURES_DIR: "/opt/agentforge/fixtures/eval",
    AGENTFORGE_ENVIRONMENTS_DIR: "/opt/agentforge/environments",
    EVALUATOR_WORKER_ID: "vercel-sandbox",
  };
  for (const name of PASSTHROUGH_MODEL_ENV) {
    const value = env[name]?.trim();
    if (value) {
      out[name] = value;
    }
  }
  return out;
}

export type GraderLaunchResult =
  | { launched: true; sandboxName: string; reason: string }
  | { launched: false; reason: string; error: string };

export async function launchGraderSandbox(reason: string): Promise<GraderLaunchResult> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      return { launched: false, reason, error: "NEXT_PUBLIC_SUPABASE_URL missing" };
    }
    const sandbox = await Sandbox.create({
      timeout: GRADER_SANDBOX_TIMEOUT_MS,
      persistent: false,
      resources: { vcpus: 4 },
      networkPolicy: { allow: graderAllowDomains(supabaseUrl) },
      env: graderSandboxEnv(process.env),
      tags: { app: "agentforge-grader", reason },
    });
    await sandbox.runCommand({
      cmd: "bash",
      args: ["-lc", graderBootstrapScript()],
      sudo: true,
      detached: true,
    });
    return { launched: true, sandboxName: sandbox.name, reason };
  } catch (error) {
    return {
      launched: false,
      reason,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
