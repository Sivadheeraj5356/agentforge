import { createHash } from "node:crypto";

export function splitTaskKeys(
  keys: readonly string[],
  seed: number,
  heldOut: number,
): { train: string[]; heldOut: string[] } {
  if (heldOut < 1) {
    throw new Error("Held-out count must be at least 1.");
  }
  if (heldOut >= keys.length) {
    throw new Error("Held-out count must be smaller than the corpus.");
  }
  const ranked = [...keys].sort((left, right) => {
    const leftHash = createHash("sha256").update(`${seed}:${left}`).digest("hex");
    const rightHash = createHash("sha256").update(`${seed}:${right}`).digest("hex");
    return leftHash.localeCompare(rightHash);
  });
  return {
    heldOut: ranked.slice(0, heldOut),
    train: ranked.slice(heldOut),
  };
}
