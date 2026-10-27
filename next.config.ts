import { execSync } from "node:child_process";
import type { NextConfig } from "next";
import pkg from "./package.json";

/**
 * Identifies this build. Must be the same for `next build` and `next start`,
 * so it comes from the environment or the git commit, never the clock.
 */
function buildId(): string {
  const fromEnv = process.env.APP_BUILD_ID || process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_SHA;
  if (fromEnv) return fromEnv.slice(0, 40);
  try {
    return execSync("git rev-parse --short=12 HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return `v${pkg.version}`;
  }
}

const BUILD_ID = buildId();

// GitHub Codespaces serves the app from *.app.github.dev through a forwarding
// proxy. Allow that host only when actually running in a codespace.
const CODESPACE_HOSTS = process.env.CODESPACES === "true" ? ["*.app.github.dev"] : [];

const nextConfig: NextConfig = {
  // Inlined at build time for both server and browser code.
  env: { APP_BUILD_ID: BUILD_ID, APP_VERSION: pkg.version },
  // Version skew protection: an outdated tab hard-reloads instead of calling
  // Server Actions that no longer exist. Vercel manages its own deployment id.
  ...(process.env.VERCEL ? {} : { deploymentId: BUILD_ID }),
  ...(CODESPACE_HOSTS.length
    ? { allowedDevOrigins: CODESPACE_HOSTS, experimental: { serverActions: { allowedOrigins: CODESPACE_HOSTS } } }
    : {}),
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
