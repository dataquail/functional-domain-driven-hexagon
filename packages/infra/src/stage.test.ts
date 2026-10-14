import { describe, expect, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";
import * as Result from "effect/Result";

import {
  appCallbackUrl,
  appSignedOutUrl,
  identityIssuer,
  kindOfStage,
  presentEntry,
  previewBranchExpiresAt,
  stageHosts,
  StageSettingMissing,
  workerName,
} from "./stage.js";

describe("kindOfStage", () => {
  it("keeps prod and staging on databases of their own", () => {
    expect(kindOfStage("prod")).toBe("long-lived");
    expect(kindOfStage("staging")).toBe("long-lived");
  });

  it("treats a pull-request or personal stage as a preview of staging", () => {
    expect(kindOfStage("pr-42")).toBe("preview");
    expect(kindOfStage("dev_alice")).toBe("preview");
  });
});

describe("previewBranchExpiresAt", () => {
  it("expires a preview branch a week after the deploy that last touched it", () => {
    const deployedAt = DateTime.makeUnsafe("2026-10-10T12:00:00Z");

    expect(previewBranchExpiresAt(deployedAt)).toBe("2026-10-17T12:00:00.000Z");
  });
});

describe("workerName", () => {
  it("names each Worker after its stage so a preview's workers.dev URL is predictable", () => {
    expect(workerName("pr-42", "web")).toBe("hexagon-pr-42-web");
    expect(workerName("dev_Alice", "identity")).toBe("hexagon-dev-alice-identity");
  });
});

describe("stageHosts", () => {
  const settings = { appDomain: Option.some("example.com"), workersSubdomain: Option.some("acme") };

  const hostsOf = (stage: string) => Result.getOrThrow(stageHosts(stage, settings));

  it("serves prod on the bare app and auth hosts", () => {
    expect(hostsOf("prod")).toEqual({
      appUrl: "https://app.example.com",
      identityUrl: "https://auth.example.com",
      appHostname: Option.some("app.example.com"),
      identityHostname: Option.some("auth.example.com"),
    });
  });

  it("serves staging one level down", () => {
    const hosts = hostsOf("staging");

    expect(hosts.appUrl).toBe("https://app.staging.example.com");
    expect(identityIssuer(hosts)).toBe("https://auth.staging.example.com/api/auth");
  });

  it("serves a preview on workers.dev, outside the zone", () => {
    const hosts = hostsOf("pr-7");

    expect(hosts).toEqual({
      appUrl: "https://hexagon-pr-7-web.acme.workers.dev",
      identityUrl: "https://hexagon-pr-7-identity.acme.workers.dev",
      appHostname: Option.none(),
      identityHostname: Option.none(),
    });
    expect(appCallbackUrl(hosts)).toBe(
      "https://hexagon-pr-7-web.acme.workers.dev/api/auth/callback",
    );
    expect(appSignedOutUrl(hosts)).toBe("https://hexagon-pr-7-web.acme.workers.dev/");
  });

  it("refuses a long-lived stage without a domain", () => {
    expect(
      stageHosts("prod", { appDomain: Option.none(), workersSubdomain: Option.some("acme") }),
    ).toEqual(Result.fail(new StageSettingMissing({ setting: "APP_DOMAIN", stage: "prod" })));
  });

  it("refuses a preview without the account's workers.dev subdomain", () => {
    expect(
      stageHosts("pr-7", {
        appDomain: Option.some("example.com"),
        workersSubdomain: Option.none(),
      }),
    ).toEqual(
      Result.fail(
        new StageSettingMissing({ setting: "CLOUDFLARE_WORKERS_SUBDOMAIN", stage: "pr-7" }),
      ),
    );
  });
});

describe("presentEntry", () => {
  it("adds the entry for a present value and leaves an absent one out", () => {
    expect({
      ...presentEntry(Option.some("https://app/cb"), (url) => ({ REDIRECT: url })),
      ...presentEntry(Option.none(), (url) => ({ LOGOUT: url })),
    }).toEqual({ REDIRECT: "https://app/cb" });
  });
});
