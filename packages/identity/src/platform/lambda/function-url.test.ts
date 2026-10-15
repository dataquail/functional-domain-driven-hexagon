import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

import { type FunctionUrlEvent, toFunctionUrlResult, toRequest } from "./function-url";

const event = (overrides: Partial<FunctionUrlEvent> = {}): FunctionUrlEvent => ({
  rawPath: "/api/auth/sign-in/email",
  rawQueryString: "",
  headers: { "content-type": "application/json" },
  requestContext: { domainName: "abc.lambda-url.us-east-2.on.aws", http: { method: "POST" } },
  body: '{"email":"ada@example.com"}',
  isBase64Encoded: false,
  ...overrides,
});

describe("toRequest", () => {
  it("answers on the public host the distribution forwarded", () => {
    const request = toRequest(
      event({ headers: { "x-forwarded-host": "auth.example.com" }, rawQueryString: "a=1" }),
    );

    expect(request.url).toBe("https://auth.example.com/api/auth/sign-in/email?a=1");
  });

  it.effect("carries the body and the cookies of the request", () =>
    Effect.gen(function* () {
      const request = toRequest(event({ cookies: ["a=1", "b=2"] }));

      expect(request.headers.get("cookie")).toBe("a=1; b=2");
      expect(yield* Effect.promise(() => request.text())).toBe('{"email":"ada@example.com"}');
    }),
  );

  it.effect("decodes a base64 body", () =>
    Effect.gen(function* () {
      const request = toRequest(
        event({ body: Buffer.from("form=1").toString("base64"), isBase64Encoded: true }),
      );

      expect(yield* Effect.promise(() => request.text())).toBe("form=1");
    }),
  );
});

describe("toFunctionUrlResult", () => {
  it.effect("carries each Set-Cookie on its own and the body as base64", () =>
    Effect.gen(function* () {
      const headers = new Headers({ location: "/signed-in" });
      headers.append("set-cookie", "a=1");
      headers.append("set-cookie", "b=2");

      const result = yield* toFunctionUrlResult(
        new Response(new Uint8Array(), { status: 302, headers }),
      );

      expect(result).toEqual({
        statusCode: 302,
        headers: { location: "/signed-in" },
        cookies: ["a=1", "b=2"],
        body: "",
        isBase64Encoded: true,
      });
    }),
  );
});
