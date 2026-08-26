import type { Json } from "@agentforge/contracts";

/**
 * Single audited bridge from a schema-validated value to Supabase's recursive
 * `Json` type. TypeScript cannot prove a concrete object matches `Json`, so the
 * narrowing lives here instead of being repeated at every insert.
 *
 * Only call this with a value that just came out of a Zod schema.
 */
export function toJson(value: unknown): Json {
  return value as Json;
}
