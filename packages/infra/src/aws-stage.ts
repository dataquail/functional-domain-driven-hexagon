import * as Schema from "effect/Schema";

// What the AWS stack derives from a stage that the Cloudflare stack does not:
// every stage answers on its own subdomain, its jobs are schedule rules, and
// its queue's retry budget is a receive count.

export const AWS_STACK = "hexagon-aws";

// The server Lambda dispatches on these inputs, one rule per job.
export const SCHEDULED_JOBS = [
  { rule: "outbox-sweep", schedule: "rate(1 minute)", job: "outbox-sweep" },
  { rule: "session-purge", schedule: "cron(0 * * * ? *)", job: "purge-expired-sessions" },
] as const;

// Cloudflare retries a message ten times; SQS counts the first delivery too.
const DOMAIN_EVENT_RETRIES = 10;
export const DOMAIN_EVENTS_MAX_RECEIVES = DOMAIN_EVENT_RETRIES + 1;

// AWS's guidance for an SQS event source: six times the function's timeout,
// so a batch still being processed is not redelivered underneath it.
export const queueVisibilityTimeoutSeconds = (functionTimeoutSeconds: number): number =>
  functionTimeoutSeconds * 6;

export type DnsRecord = { readonly name: string; readonly value: string };

// SES verifies a domain by the three CNAMEs its Easy DKIM tokens name.
export const sesDkimRecords = (domain: string, tokens: ReadonlyArray<string>): Array<DnsRecord> =>
  tokens.map((token) => ({
    name: `${token}._domainkey.${domain}`,
    value: `${token}.dkim.amazonses.com`,
  }));

const ScheduledJob = Schema.fromJsonString(Schema.Struct({ job: Schema.String }));

export const scheduledJobInput = (job: string): string => Schema.encodeSync(ScheduledJob)({ job });
