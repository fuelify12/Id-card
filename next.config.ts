import type { NextConfig } from "next";
import { getSecurityHeaders } from "./lib/security/headers";

const securityHeaders = [
  ...getSecurityHeaders(process.env.NODE_ENV === "production").map(({ key, value }) => ({
    key: key === "Content-Security-Policy" ? "Content-Security-Policy-Report-Only" : key,
    value,
  })),
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Template uploads allow files up to 20 MB. Next.js defaults Server Actions
  // to 1 MB, which rejects valid uploads before uploadTemplate() can validate them.
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
  outputFileTracingIncludes: {
    "/api/projects/*/render": ["./node_modules/@fontsource/noto-sans*/files/*.woff2"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
