import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits a self-contained server bundle so the Docker runtime stage can drop
  // node_modules and the source entirely.
  output: "standalone",
};

export default nextConfig;
