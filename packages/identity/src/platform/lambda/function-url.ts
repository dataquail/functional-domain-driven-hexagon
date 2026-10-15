import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

// The slice of a Lambda Function URL request (payload format 2.0) the issuer reads.
export const FunctionUrlEvent = Schema.Struct({
  rawPath: Schema.String,
  rawQueryString: Schema.String,
  cookies: Schema.optional(Schema.Array(Schema.String)),
  headers: Schema.Record(Schema.String, Schema.String),
  requestContext: Schema.Struct({
    domainName: Schema.String,
    http: Schema.Struct({ method: Schema.String }),
  }),
  body: Schema.optional(Schema.String),
  isBase64Encoded: Schema.Boolean,
});

export type FunctionUrlEvent = typeof FunctionUrlEvent.Type;

export type FunctionUrlResult = {
  readonly statusCode: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly cookies: ReadonlyArray<string>;
  readonly body: string;
  readonly isBase64Encoded: true;
};

const carriesBody = (method: string) => method !== "GET" && method !== "HEAD";

const decodedBody =
  (event: FunctionUrlEvent) =>
  (body: string): BodyInit => {
    if (event.isBase64Encoded) return new Uint8Array(Buffer.from(body, "base64"));

    return body;
  };

const requestBody = (event: FunctionUrlEvent): Option.Option<BodyInit> =>
  Option.fromUndefinedOr(event.body).pipe(
    Option.filter(() => carriesBody(event.requestContext.http.method)),
    Option.map(decodedBody(event)),
  );

const requestHeaders = (event: FunctionUrlEvent): Headers => {
  const headers = new Headers(event.headers);

  const cookies = Option.fromUndefinedOr(event.cookies).pipe(
    Option.filter((all) => all.length > 0),
  );

  if (Option.isSome(cookies)) headers.set("cookie", cookies.value.join("; "));

  return headers;
};

const queryOf = (rawQueryString: string): string => {
  if (rawQueryString.length === 0) return "";

  return `?${rawQueryString}`;
};

// The issuer answers on its own public host, which a distribution may forward as
// x-forwarded-host; the Lambda's own domain is the fallback.
const hostOf = (event: FunctionUrlEvent): string =>
  Option.getOrElse(
    Option.fromUndefinedOr(event.headers["x-forwarded-host"]),
    () => event.requestContext.domainName,
  );

export const toRequest = (event: FunctionUrlEvent): Request =>
  new Request(`https://${hostOf(event)}${event.rawPath}${queryOf(event.rawQueryString)}`, {
    method: event.requestContext.http.method,
    headers: requestHeaders(event),
    ...Option.match(requestBody(event), {
      onNone: () => ({}),
      onSome: (body) => ({ body, duplex: "half" }),
    }),
  });

const plainHeaders = (response: Response) =>
  Object.fromEntries([...response.headers].filter(([name]) => name !== "set-cookie"));

// Function URLs carry Set-Cookie apart from the other headers, one entry per cookie.
export const toFunctionUrlResult = (response: Response): Effect.Effect<FunctionUrlResult> =>
  Effect.map(
    Effect.promise(() => response.arrayBuffer()),
    (bytes) => ({
      statusCode: response.status,
      headers: plainHeaders(response),
      cookies: response.headers.getSetCookie(),
      body: Buffer.from(bytes).toString("base64"),
      isBase64Encoded: true,
    }),
  );
