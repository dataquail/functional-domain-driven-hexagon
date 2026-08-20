#!/usr/bin/env node
// Publishes the Compose services' ports inside the dev container.
//
// Codespaces only forwards ports that something is listening on in the *primary*
// container. The dev-containers spec's `"service:port"` form of `forwardPorts`,
// which would forward straight from a sibling Compose service, is not
// implemented there — it is silently ignored. Without this, Zitadel is
// unreachable from the browser and from the server's OIDC back channel, even
// though both can see it over the Compose network.
//
// Zitadel additionally needs its traffic repaired, not just relayed: GitHub's
// forwarder rewrites the inbound `Host` to `localhost:<port>` and moves the
// real hostname to `X-Forwarded-Host`. Zitadel derives the domain of its
// `zitadel.useragent` cookie from `Host`, so it would scope that cookie to
// `localhost`, the browser would drop it, and the login UI would then fail
// every request with "User Agent does not correspond". So that one port is
// proxied at the HTTP layer with the header put back.

import { connect, createServer } from "node:net";
import { createServer as createHttpServer, request as httpRequest } from "node:http";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { readEnv } from "./lib/env-file.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ENV_PATH = join(ROOT, ".env");
const env = existsSync(ENV_PATH) ? readEnv(ENV_PATH) : {};

// Only set in a codespace; on a laptop the browser reaches Zitadel directly and
// the relay stays a plain byte pipe.
const zitadelHostHeader =
  env.ZITADEL_INSTANCE_HOST !== undefined && env.ZITADEL_INSTANCE_HOST.length > 0
    ? env.ZITADEL_INSTANCE_HOST
    : null;

const FORWARDS = [
  { port: 8080, host: "zitadel", label: "zitadel", hostHeader: zitadelHostHeader },
  { port: 8025, host: "mailpit", label: "mailpit" },
  { port: 16686, host: "jaeger", label: "jaeger UI" },
  { port: 4318, host: "jaeger", label: "jaeger OTLP/HTTP" },
  { port: 5432, host: "postgres", label: "postgres" },
];

function announce(server, { port, host, label }, how) {
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.log(`  :${port} already bound — leaving it alone (${label})`);
      return;
    }
    console.error(`  :${port} failed: ${err.message}`);
  });
  // Codespaces also auto-forwards ports it sees announced as a localhost URL.
  server.listen(port, "0.0.0.0", () =>
    console.log(`  http://localhost:${port} -> ${host}:${port} (${label}${how})`),
  );
}

function startRelay(forward) {
  const { port, host } = forward;
  const server = createServer((client) => {
    const upstream = connect({ host, port });
    // A dead upstream must not take the listener down with it: the services
    // restart independently of this process.
    const drop = () => {
      client.destroy();
      upstream.destroy();
    };
    client.on("error", drop);
    upstream.on("error", drop);
    client.pipe(upstream);
    upstream.pipe(client);
  });
  announce(server, forward, "");
}

function startHostRewritingProxy(forward) {
  const { port, host, hostHeader } = forward;
  const server = createHttpServer((clientRequest, clientResponse) => {
    const upstream = httpRequest(
      {
        host,
        port,
        method: clientRequest.method,
        path: clientRequest.url,
        headers: { ...clientRequest.headers, host: hostHeader },
      },
      (upstreamResponse) => {
        clientResponse.writeHead(upstreamResponse.statusCode, upstreamResponse.headers);
        upstreamResponse.pipe(clientResponse);
      },
    );
    upstream.on("error", (err) => {
      clientResponse.writeHead(502, { "content-type": "text/plain" });
      clientResponse.end(`upstream ${host}:${port} unavailable: ${err.message}`);
    });
    clientRequest.on("error", () => upstream.destroy());
    clientRequest.pipe(upstream);
  });
  announce(server, forward, `, Host: ${hostHeader}`);
}

for (const forward of FORWARDS) {
  if (forward.hostHeader != null) startHostRewritingProxy(forward);
  else startRelay(forward);
}
