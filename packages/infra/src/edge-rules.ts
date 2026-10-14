import * as Schema from "effect/Schema";

export type EdgeHostnames = {
  readonly app: ReadonlyArray<string>;
  readonly identity: ReadonlyArray<string>;
};

export type BlockRule = {
  readonly description: string;
  readonly expression: string;
  readonly action: "block";
  readonly enabled: boolean;
};

export type RateLimitRule = BlockRule & {
  readonly ratelimit: {
    readonly characteristics: Array<string>;
    readonly period: number;
    readonly requestsPerPeriod: number;
    readonly mitigationTimeout: number;
  };
};

// Per client IP, per Cloudflare data centre: 20 attempts a minute, then ten minutes blocked.
const AUTH_ATTEMPTS_PER_MINUTE = 20;
const AUTH_BLOCK_SECONDS = 600;

// A ruleset expression quotes each hostname as a JSON string literal.
const quoted = Schema.encodeSync(Schema.fromJsonString(Schema.String));

const hostSet = (hostnames: ReadonlyArray<string>): string =>
  `{${hostnames.map((hostname) => quoted(hostname)).join(" ")}}`;

const allHostnames = (hosts: EdgeHostnames): ReadonlyArray<string> => [
  ...hosts.app,
  ...hosts.identity,
];

export const authRateLimitRule = (hosts: EdgeHostnames): RateLimitRule => ({
  description: "Rate-limit sign-in, sign-up and the app's auth endpoints",
  expression:
    `(http.host in ${hostSet(hosts.identity)} and starts_with(http.request.uri.path, "/api/auth/sign-"))` +
    ` or (http.host in ${hostSet(hosts.app)} and starts_with(http.request.uri.path, "/api/auth/"))`,
  action: "block",
  enabled: true,
  ratelimit: {
    characteristics: ["cf.colo.id", "ip.src"],
    period: 60,
    requestsPerPeriod: AUTH_ATTEMPTS_PER_MINUTE,
    mitigationTimeout: AUTH_BLOCK_SECONDS,
  },
});

export const killSwitchRule = (hosts: EdgeHostnames, engaged: boolean): BlockRule => ({
  description: "Kill switch: refuse every request to the app and identity hosts",
  expression: `http.host in ${hostSet(allHostnames(hosts))}`,
  action: "block",
  enabled: engaged,
});
