import type { NextConfig } from "next";

// Turbopack detects the workspace root from the root pnpm-lock.yaml.
const config: NextConfig = {
  devIndicators: false,
};
export default config;
