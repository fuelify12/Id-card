import type { NextConfig } from "next";
import { getSecurityHeaders } from "@/lib/security/headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/api/projects/*/render": ["./node_modules/@fontsource/noto-sans*/files/*.woff2"],
  },
  async headers() {
    const headers = getSecurityHeaders();
    return [
      {
        source: "/:path*",
        headers: headers.map(({ key, value }) => ({ key, value })),
      },
    ];
  },
};

export default nextConfig;
