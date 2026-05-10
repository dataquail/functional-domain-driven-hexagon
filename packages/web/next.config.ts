import type { NextConfig } from "next";

// Same-origin proxy to the Effect server. The browser only ever sees the
// Next origin; `/api/*` is forwarded to the Effect server with the inbound
// `Cookie` header attached and the `Set-Cookie` response flowing back
// unchanged, so the session cookie scopes to the Next origin and we avoid
// CORS entirely. See ADR-0018.
//
// `SERVER_INTERNAL_URL` is the URL Next reaches the Effect server on. In
// dev it's localhost; in prod it's a service name on the internal network.
// The fallback keeps `pnpm -F @org/web dev` working without env, but the
// shared `.env` (loaded via `dotenv -e ../../.env`) sets it explicitly.
const SERVER_INTERNAL_URL = process.env.SERVER_INTERNAL_URL ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${SERVER_INTERNAL_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
