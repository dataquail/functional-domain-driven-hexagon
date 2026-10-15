import { AwsV4Signer } from "aws4fetch";
import * as Effect from "effect/Effect";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";

export type AwsCredentials = {
  readonly accessKeyId: string;
  readonly secretAccessKey: Redacted.Redacted;
  readonly sessionToken: Option.Option<Redacted.Redacted>;
  readonly region: string;
};

// The variables the Lambda runtime sets for the function's execution role.
const LambdaCredentials = Schema.Struct({
  AWS_ACCESS_KEY_ID: Schema.String,
  AWS_SECRET_ACCESS_KEY: Schema.String,
  AWS_SESSION_TOKEN: Schema.optional(Schema.String),
  AWS_REGION: Schema.String,
});

export const awsCredentialsFrom = (env: NodeJS.ProcessEnv): Option.Option<AwsCredentials> =>
  Option.map(Schema.decodeUnknownOption(LambdaCredentials)(env), (variables) => ({
    accessKeyId: variables.AWS_ACCESS_KEY_ID,
    secretAccessKey: Redacted.make(variables.AWS_SECRET_ACCESS_KEY),
    sessionToken: Option.map(Option.fromUndefinedOr(variables.AWS_SESSION_TOKEN), Redacted.make),
    region: variables.AWS_REGION,
  }));

export type AwsPost = {
  readonly service: string;
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
};

export class AwsRequestFailed extends Schema.TaggedError<
  AwsRequestFailed,
  { readonly brand: "AwsRequestFailed" }
>()("AwsRequestFailed", { service: Schema.String, message: Schema.String }) {}

const decodeJson = Schema.decodeEffect(Schema.fromJsonString(Schema.Json));

export const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Json));

const signed = (credentials: AwsCredentials, post: AwsPost) =>
  Effect.promise(() =>
    new AwsV4Signer({
      method: "POST",
      url: post.url,
      headers: post.headers,
      body: post.body,
      service: post.service,
      region: credentials.region,
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: Redacted.value(credentials.secretAccessKey),
      ...Option.match(credentials.sessionToken, {
        onNone: () => ({}),
        onSome: (token) => ({ sessionToken: Redacted.value(token) }),
      }),
    }).sign(),
  );

const failed = (service: string) => (message: string) => new AwsRequestFailed({ service, message });

// SigV4-signed over the plain HTTP client, so no AWS SDK enters the bundle.
export const awsPost = Effect.fn("awsPost")(function* (credentials: AwsCredentials, post: AwsPost) {
  const client = yield* HttpClient.HttpClient;
  const request = yield* signed(credentials, post);
  const fail = failed(post.service);

  const response = yield* client
    .execute(
      HttpClientRequest.post(post.url).pipe(
        HttpClientRequest.setHeaders(Object.fromEntries(request.headers.entries())),
        HttpClientRequest.bodyText(post.body, post.headers["content-type"]),
      ),
    )
    .pipe(Effect.mapError((error) => fail(error.message)));

  const text = yield* response.text.pipe(Effect.mapError((error) => fail(error.message)));

  if (response.status >= 300) {
    return yield* fail(`HTTP ${response.status}: ${text}`);
  }

  if (text.length === 0) return Option.none<Schema.Json>();

  return yield* decodeJson(text).pipe(
    Effect.asSome,
    Effect.mapError((error) => fail(error.message)),
  );
});
