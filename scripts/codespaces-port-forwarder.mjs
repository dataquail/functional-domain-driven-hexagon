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
// Each entry below listens on localhost:<port> here and pipes to the service.

import { createServer, connect } from "node:net";

const FORWARDS = [
  { port: 8080, host: "zitadel", label: "zitadel" },
  { port: 8025, host: "mailpit", label: "mailpit" },
  { port: 16686, host: "jaeger", label: "jaeger UI" },
  { port: 4318, host: "jaeger", label: "jaeger OTLP/HTTP" },
  { port: 5432, host: "postgres", label: "postgres" },
];

for (const { port, host, label } of FORWARDS) {
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

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.log(`  :${port} already bound — leaving it alone (${label})`);
      return;
    }
    console.error(`  :${port} failed: ${err.message}`);
  });

  server.listen(port, "0.0.0.0", () => {
    // Codespaces also auto-forwards ports it sees announced as a localhost URL.
    console.log(`  http://localhost:${port} -> ${host}:${port} (${label})`);
  });
}
