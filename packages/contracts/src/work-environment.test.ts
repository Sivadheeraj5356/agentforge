import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  ExperiencePackSchema,
  EXPERIENCE_PACK_CATALOG,
  getExperiencePack,
  simulatedLabel,
  stagedReward,
  StartEnvironmentInputSchema,
} from "./work-environment";

const PACKS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../environments/packs",
);

describe("ExperiencePackSchema", () => {
  it("accepts every sale manifest on disk", () => {
    const files = readdirSync(PACKS_DIR).filter((file) => file.endsWith(".json"));
    expect(files.length).toBe(EXPERIENCE_PACK_CATALOG.length);
    for (const file of files) {
      const raw = JSON.parse(readFileSync(path.join(PACKS_DIR, file), "utf8")) as unknown;
      const pack = ExperiencePackSchema.parse(raw);
      expect(pack.rewardRecipe).toBe("staged");
      const weightSum = pack.stages.reduce((acc, stage) => acc + stage.weight, 0);
      expect(weightSum).toBeCloseTo(1, 9);
    }
  });

  it("rejects stage weights that do not sum to 1", () => {
    const pack = EXPERIENCE_PACK_CATALOG[0];
    expect(pack).toBeDefined();
    expect(() =>
      ExperiencePackSchema.parse({
        ...pack,
        stages: [{ id: "only", label: "Only", weight: 0.5, metricKey: "service_health" }],
      }),
    ).toThrow();
  });
});

describe("catalog", () => {
  it("matches disk keys", () => {
    expect(getExperiencePack("orders-ops")?.catalogTaskKey).toBe("broken-orders-api");
    expect(getExperiencePack("production-incident-eu-payments")?.sandboxProvider).toBe("work");
    expect(getExperiencePack("checkout-console-clone")?.family).toBe("app-clone");
    expect(getExperiencePack("private-eval-long-horizon")?.family).toBe("private-eval");
    expect(getExperiencePack("horizon-swe")?.catalogTaskKey).toBe("ledger-evolve");
    expect(getExperiencePack("wave-inventory")?.family).toBe("evolving-spec");
    expect(getExperiencePack("skill-constraint")?.family).toBe("skill-follow");
    expect(getExperiencePack("incident-us-inventory")?.family).toBe("production-incident");
    expect(getExperiencePack("wave-pricing")?.family).toBe("evolving-spec");
    expect(getExperiencePack("support-desk-clone")?.family).toBe("app-clone");
    expect(getExperiencePack("checkout-console-clone")?.siblingTaskKeys).toBeUndefined();
    expect(getExperiencePack("private-eval-long-horizon")?.siblingTaskKeys).toEqual([
      "private-eval-skipped-session",
      "private-eval-forced-green",
      "private-eval-wiped-artifacts",
    ]);
    expect(getExperiencePack("private-eval-skipped-session")).toBeUndefined();
    expect(EXPERIENCE_PACK_CATALOG.map((pack) => pack.key)).not.toContain(
      "private-eval-skipped-session",
    );
    expect(JSON.stringify(EXPERIENCE_PACK_CATALOG)).not.toMatch(/checkout-wrong-currency/);
    expect(simulatedLabel("slack")).toBe("Simulated Slack");
    expect(simulatedLabel("checkout-ui")).toBe("Simulated checkout UI");
    expect(simulatedLabel("ops-console")).toBe("Simulated ops console");
    expect(simulatedLabel("inventory-console")).toBe("Simulated inventory console");
    expect(simulatedLabel("skill-file")).toBe("Simulated SKILL.md");
    expect(simulatedLabel("returns-desk")).toBe("Simulated returns desk");
    expect(simulatedLabel("ticket-queue")).toBe("Simulated ticket queue");
  });
});

describe("stagedReward", () => {
  it("is a weighted sum in unit interval", () => {
    const pack = getExperiencePack("production-incident-eu-payments");
    expect(pack).toBeDefined();
    if (!pack) {
      return;
    }
    expect(
      stagedReward(pack.stages, {
        service_health: 1,
        root_cause: 1,
        data_preserved: 1,
        safe_rollback: 1,
        communication: 1,
      }),
    ).toBe(1);
    expect(
      stagedReward(pack.stages, {
        service_health: 0,
        root_cause: 0,
        data_preserved: 1,
        safe_rollback: 0,
        communication: 0,
      }),
    ).toBe(0.2);
  });

  it("scores checkout clone inventory-only as 0.15", () => {
    const pack = getExperiencePack("checkout-console-clone");
    expect(pack).toBeDefined();
    if (!pack) {
      return;
    }
    expect(
      stagedReward(pack.stages, {
        located_order: 0,
        tax_corrected: 0,
        checkout_via_ui: 0,
        inventory_held: 1,
        refund_partial: 0,
        audit_note: 0,
        return_authorized: 0,
      }),
    ).toBe(0.15);
  });

  it("scores private-eval artifacts-only as 0.15", () => {
    const pack = getExperiencePack("private-eval-long-horizon");
    expect(pack).toBeDefined();
    if (!pack) {
      return;
    }
    expect(
      stagedReward(pack.stages, {
        triage_done: 0,
        repair_done: 0,
        check_green: 0,
        artifacts_held: 1,
        handoff_done: 0,
        session_order: 0,
      }),
    ).toBe(0.15);
  });
});

describe("StartEnvironmentInputSchema", () => {
  it("requires a pack key", () => {
    expect(
      StartEnvironmentInputSchema.parse({
        organizationSlug: "acme",
        projectSlug: "demo",
        packKey: "orders-ops",
      }).agentKind,
    ).toBe("oracle");
    expect(() =>
      StartEnvironmentInputSchema.parse({
        organizationSlug: "acme",
        projectSlug: "demo",
      }),
    ).toThrow();
  });
});
