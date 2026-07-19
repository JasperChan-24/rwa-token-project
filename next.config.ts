import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Vercel builds only the frontend. Contract tests and deployment scripts are
    // type-checked separately after Hardhat has generated its local artifacts.
    tsconfigPath: "tsconfig.next.json",
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
