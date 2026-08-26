import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { ValidationReport } from "@agentforge/contracts";
import { describe, expect, it } from "vitest";

import { FIXTURE_IDS, fixtureZip, type FixtureId } from "../fixtures";
import { runValidationPipeline } from "./run";

const GOLDEN_DIRECTORY = path.join(path.dirname(fileURLToPath(import.meta.url)), "goldens");
const UPDATE_GOLDENS =
  process.env.AGENTFORGE_UPDATE_GOLDENS === "1" || process.env.VORTEX_UPDATE_GOLDENS === "1";

/**
 * Golden reports pin the full report shape: outcome, ordering, ordinals,
 * fingerprints, categories, and evidence. Run-specific values that say nothing
 * about validation logic are replaced with sentinels: the archive digest and byte
 * size describe fixture bytes, and duration is wall-clock.
 */
function normalizeForGolden(report: ValidationReport): unknown {
  return {
    ...report,
    artifact: { contentHash: "<sha256>", byteSize: 0 },
    durationMs: 0,
  };
}

function goldenPath(id: FixtureId): string {
  return path.join(GOLDEN_DIRECTORY, `${id}.json`);
}

function readGolden(id: FixtureId): unknown {
  return JSON.parse(readFileSync(goldenPath(id), "utf8"));
}

function writeGolden(id: FixtureId, value: unknown): void {
  mkdirSync(GOLDEN_DIRECTORY, { recursive: true });
  writeFileSync(goldenPath(id), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

describe("golden validation reports", () => {
  for (const id of FIXTURE_IDS) {
    it(`matches the golden report for the ${id} fixture`, async () => {
      const report = await runValidationPipeline({
        archiveBytes: fixtureZip(id),
        clock: () => 0,
      });
      const normalized = normalizeForGolden(report);

      if (UPDATE_GOLDENS) {
        writeGolden(id, normalized);
      }

      expect(normalized).toEqual(readGolden(id));
    });
  }
});
