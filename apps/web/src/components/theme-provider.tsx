"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactElement, ReactNode } from "react";

export function ThemeProvider({
  children,
}: Readonly<{
  children: ReactNode;
}>): ReactElement {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
