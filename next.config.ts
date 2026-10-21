import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  agentRules: false,
  experimental: {
    staleTimes: { dynamic: 0 },
  },
  allowedDevOrigins: ['100.122.36.78']
};

export default nextConfig;
