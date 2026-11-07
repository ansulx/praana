import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Microphone is needed for voice check-ins on our own origin only; camera for wound photos.
  { key: "Permissions-Policy", value: "microphone=(self), camera=(self), geolocation=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Native/WASM packages must not be bundled by webpack.
  serverExternalPackages: ["@electric-sql/pglite", "ioredis", "pg", "bcryptjs"],
  // Keep SQL migrations in the serverless function file trace (used at boot on Vercel).
  outputFileTracingIncludes: {
    "/*": ["./drizzle/**/*"],
  },
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
    optimizePackageImports: ["lucide-react", "recharts", "date-fns"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
