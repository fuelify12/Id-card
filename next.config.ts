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
