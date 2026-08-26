import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@agentforge/ui", "@agentforge/contracts", "@agentforge/security", "@agentforge/validation"],
  reactStrictMode: true,
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    serverActions: {
      bodySizeLimit: "32mb",
    },
  },
};

export default nextConfig;
