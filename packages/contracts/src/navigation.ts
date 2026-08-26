import { z } from "zod";

export const NavigationItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  href: z.string().min(1),
});

export const AppShellNavSchema = z.object({
  primary: z.array(NavigationItemSchema).min(1),
  secondary: z.array(NavigationItemSchema),
});

export type NavigationItem = z.infer<typeof NavigationItemSchema>;
export type AppShellNav = z.infer<typeof AppShellNavSchema>;
