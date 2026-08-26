import { createHash } from "node:crypto";

import { Sha256HexSchema, type Sha256Hex } from "@agentforge/contracts";

export function sha256Hex(bytes: Uint8Array): Sha256Hex {
  const digest = createHash("sha256").update(bytes).digest("hex");
  return Sha256HexSchema.parse(digest);
}
