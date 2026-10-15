import * as Alchemy from "alchemy";
import * as AWS from "alchemy/AWS";
import * as Neon from "alchemy/Neon";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { AWS_STACK } from "./src/aws-stage";
import { appDatabaseUrls, identityDatabaseUrls } from "./src/stack/aws/databases";
import { mailDomain } from "./src/stack/aws/email";
import { identityFunction, identitySite, serverFunction, webSite } from "./src/stack/aws/functions";
import { awsUrls } from "./src/stack/aws/hosts";

class AwsStackHasNoDevMode extends Error {
  public override readonly message =
    "The AWS stack is deploy-only: `pnpm dev` runs the Cloudflare stack, which serves the same code.";
}

// The same application as alchemy.run.ts, on AWS: the server and the issuer are
// Lambdas, the web app a SvelteKit site on Lambda behind CloudFront, the domain
// events an SQS queue, the jobs EventBridge rules and the mail SES. Neon stays the
// database. Deploy with `pnpm deploy:aws --stage <s>`.
export default Alchemy.Stack(
  AWS_STACK,
  { providers: AWS.providers().pipe(Layer.provideMerge(Neon.providers())), state: AWS.state() },
  Effect.gen(function* () {
    if (yield* Alchemy.ALCHEMY_DEV) return yield* Effect.die(new AwsStackHasNoDevMode());

    const mail = yield* mailDomain;
    const identity = yield* identityFunction(mail);
    const issuer = yield* identitySite(identity);
    const { deadLetters, fn: server, queue } = yield* serverFunction(mail);
    const web = yield* webSite(server);
    const app = yield* appDatabaseUrls;
    const identityDatabase = yield* identityDatabaseUrls;

    // Outputs named like environment variables are what the deploy pipeline
    // exports to its migrate, seed and acceptance steps (scripts/stage-env.mjs).
    return {
      ...(yield* awsUrls),
      DATABASE_URL: app.direct,
      IDENTITY_DATABASE_URL: identityDatabase.direct,
      domainEventsQueue: queue.queueName,
      domainEventsDeadLetterQueue: deadLetters.queueName,
      identityUrl: issuer.url,
      serverUrl: server.functionUrl,
      webUrl: web.url,
    };
  }),
);
