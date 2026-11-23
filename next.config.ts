import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { isPublicSupabaseKey } from "./lib/env";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (publicKey && (!isPublicSupabaseKey(publicKey) || publicKey === process.env.SUPABASE_SERVICE_ROLE_KEY)) {
  throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY must be scoped for public use.");
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  agentRules: false,
  logging: {
    incomingRequests: { ignore: [/^\/care\/t(?:\/|$)/] },
    serverFunctions: false
  },
  turbopack: {
    root: projectRoot
  }
};

export default nextConfig;
