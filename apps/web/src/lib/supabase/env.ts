function requiredPublicEnv(
  name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  value: string | undefined,
): string {
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

export function getSupabasePublicEnv(): {
  url: string;
  anonKey: string;
} {
  // Literal property access so Next.js can inline NEXT_PUBLIC_* values into browser bundles.
  return {
    url: requiredPublicEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    anonKey: requiredPublicEnv(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),
  };
}
