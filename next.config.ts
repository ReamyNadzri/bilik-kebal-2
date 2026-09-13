import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Stops `next dev` writing AGENTS.md and a stub CLAUDE.md into the worktree.
  // The stub would overwrite the real project CLAUDE.md if committed.
  agentRules: false,

  // Playwright drives the dev server over 127.0.0.1 while Next serves
  // localhost. Without this, Next blocks cross-origin access to /_next/*
  // dev resources, the client chunks never load, and Client Components
  // silently fail to hydrate. Development only; it has no production effect.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
