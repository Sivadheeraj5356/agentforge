import { createStoredZip } from "../archive/zip";
import { fixturePackage, type FixtureId } from "./packages";

const encoder = new TextEncoder();

/**
 * Builds a deterministic ZIP for a fixture. Same fixture, same bytes, same
 * content hash — which is what makes golden reports comparable.
 */
export function fixtureZip(id: FixtureId, prefix = ""): Uint8Array {
  const pkg = fixturePackage(id);
  return createStoredZip(
    [...pkg.files]
      .sort((left, right) => (left.path < right.path ? -1 : 1))
      .map((file) => ({
        path: prefix ? `${prefix}/${file.path}` : file.path,
        data: encoder.encode(file.content),
      })),
  );
}

/** Complete package used by the Playwright upload flow. */
export function validTerminusZip(prefix = ""): Uint8Array {
  return fixtureZip("valid", prefix);
}

export { FIXTURE_IDS, fixturePackage } from "./packages";
export type { FixtureFile, FixtureId, FixturePackage } from "./packages";
export { FIXTURE_EXPECTATIONS, fixtureExpectation } from "./expected";
export type { FixtureExpectation } from "./expected";
