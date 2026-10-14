import { describe, expect, it } from "@effect/vitest";
import * as Redacted from "effect/Redacted";

import { requiresTls } from "./connection-url.ts";

const url = (value: string) => Redacted.make(value);

describe("requiresTls", () => {
  it("connects over TLS when the URL asks for it, as Neon's does", () => {
    expect(
      requiresTls(url("postgresql://u:p@ep-x.us-east-2.aws.neon.tech/neondb?sslmode=require")),
    ).toBe(true);
    expect(requiresTls(url("postgresql://u:p@db.example.com/app?sslmode=verify-full"))).toBe(true);
  });

  it("connects in plain text to a URL that does not, like the docker database", () => {
    expect(requiresTls(url("postgresql://postgres:postgres@localhost:5432/effect-monorepo"))).toBe(
      false,
    );
    expect(requiresTls(url("postgresql://u:p@localhost/app?sslmode=disable"))).toBe(false);
  });
});
