import { describe, expect, it } from "@effect/vitest";
import * as Redacted from "effect/Redacted";

import { driverSettings } from "../src/pg-driver.ts";

const url = Redacted.make("postgres://user:pass@localhost:5432/app");

describe("driverSettings", () => {
  it("keeps the driver's own pooling and prepared statements by default", () => {
    const settings = driverSettings({ url, ssl: false });

    expect(settings.prepare).toBeUndefined();
    expect(settings.maxConnections).toBeUndefined();
  });

  it("stops preparing named statements behind a transaction-mode pooler", () => {
    const settings = driverSettings({ url, ssl: false, behindTransactionPooler: true });

    expect(settings.prepare).toBe(false);
  });

  it("holds at most two connections per client behind a transaction-mode pooler", () => {
    const settings = driverSettings({ url, ssl: false, behindTransactionPooler: true });

    expect(settings.maxConnections).toBe(2);
  });

  it("verifies the server certificate only when ssl is on", () => {
    expect(driverSettings({ url, ssl: true }).ssl).toEqual({ rejectUnauthorized: true });
    expect(driverSettings({ url, ssl: false }).ssl).toBeUndefined();
  });
});
