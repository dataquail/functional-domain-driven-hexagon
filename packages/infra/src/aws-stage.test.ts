import { describe, expect, it } from "@effect/vitest";

import {
  DOMAIN_EVENTS_MAX_RECEIVES,
  queueVisibilityTimeoutSeconds,
  SCHEDULED_JOBS,
  scheduledJobInput,
  sesDkimRecords,
} from "./aws-stage";

describe("the AWS stage", () => {
  it("retries a domain event as often as the Cloudflare queue does", () => {
    expect(DOMAIN_EVENTS_MAX_RECEIVES).toBe(11);
  });

  it("holds an in-flight batch for six function timeouts", () => {
    expect(queueVisibilityTimeoutSeconds(30)).toBe(180);
  });

  it("sends each schedule rule's job as the event the server dispatches on", () => {
    expect(SCHEDULED_JOBS.map(({ job }) => scheduledJobInput(job))).toEqual([
      '{"job":"outbox-sweep"}',
      '{"job":"purge-expired-sessions"}',
    ]);
  });

  it("names a DKIM CNAME per token under the domain", () => {
    expect(sesDkimRecords("example.com", ["abc", "def"])).toEqual([
      { name: "abc._domainkey.example.com", value: "abc.dkim.amazonses.com" },
      { name: "def._domainkey.example.com", value: "def.dkim.amazonses.com" },
    ]);
  });
});
