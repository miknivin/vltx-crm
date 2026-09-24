import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // The CRM lives nested inside the website's folder, which is itself a
  // Next.js project with its own package-lock.json. Without this, Next infers
  // the *website's* directory as the build's workspace root (it walks up
  // looking for a lockfile) and traces output files from there — pulling the
  // sibling site's node_modules into scope for no reason. Pinning the root
  // here is what the "multiple lockfiles" build warning asks for.
  outputFileTracingRoot: path.join(__dirname),
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ["@svgr/webpack"],
    });
    return config;
  },
};

export default nextConfig;