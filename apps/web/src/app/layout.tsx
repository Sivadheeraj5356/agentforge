import type { Metadata } from "next";
import type { ReactElement, ReactNode } from "react";
import { IBM_Plex_Mono, IBM_Plex_Sans, Source_Serif_4 } from "next/font/google";

import "@agentforge/ui/globals.css";

import { ThemeProvider } from "@/components/theme-provider";

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-agentforge-sans",
  display: "swap",
});

const serif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-agentforge-serif",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-agentforge-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://agentforge-omega-khaki.vercel.app"),
  title: {
    default: "AgentForge",
    template: "%s · AgentForge",
  },
  description:
    "Evaluation infrastructure for private AI agent work environments and reproducible trials.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "https://agentforge-omega-khaki.vercel.app/",
    siteName: "AgentForge",
    title: "AgentForge",
    description:
      "Evaluation infrastructure for private AI agent work environments and reproducible trials.",
  },
  twitter: {
    card: "summary",
    title: "AgentForge",
    description:
      "Evaluation infrastructure for private AI agent work environments and reproducible trials.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>): ReactElement {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${serif.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh font-sans" suppressHydrationWarning>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "AgentForge",
              url: "https://agentforge-omega-khaki.vercel.app/",
              description:
                "Evaluation infrastructure for private AI agent work environments and reproducible trials.",
              applicationCategory: "DeveloperApplication",
              operatingSystem: "Any",
              author: {
                "@type": "Person",
                name: "Siva Dheeraj",
                url: "https://sivadheeraj.vercel.app/",
              },
            }),
          }}
        />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
