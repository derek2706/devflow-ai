import type { NextConfig } from "next";
import path from "node:path";
import { developmentApiRewrites } from "./api-rewrite.cjs";

const workspaceRoot = path.resolve(__dirname, "../..");
const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: { root: workspaceRoot },
  outputFileTracingRoot: workspaceRoot,
  async rewrites() {
    // Keep the existing local API watcher/environment on port 5001. Production
    // has no external rewrite: the native Next API route delegates to Express.
    return {
      beforeFiles: developmentApiRewrites(),
      afterFiles: [],
      fallback: [],
    };
  },
};
export default nextConfig;
