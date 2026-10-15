import * as Alchemy from "alchemy";
import * as AWS from "alchemy/AWS";
import * as Output from "alchemy/Output";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";

import { sesDkimRecords } from "../../aws-stage";
import { hostedZoneId } from "./hosts";

const DKIM_RECORDS = [1, 2, 3];

// One SES identity for the app's domain, shared by every stage in the account: each
// stage adopts it and its DKIM records, and none deletes them when it is destroyed.
export const mailDomain = Effect.gen(function* () {
  const domain = yield* Config.String("APP_DOMAIN");
  const zone = yield* hostedZoneId;

  const identity = yield* AWS.SES.EmailIdentity("mail-domain", { emailIdentity: domain }).pipe(
    Alchemy.AdoptPolicy.adopt(true),
    Alchemy.RemovalPolicy.retain(),
  );

  yield* Effect.forEach(DKIM_RECORDS, (position) => {
    const record = Output.map(identity.dkimTokens, (tokens: Array<string>) => {
      const dkim = sesDkimRecords(domain, tokens)[position - 1];

      return { name: dkim?.name ?? "", value: dkim?.value ?? "" };
    });

    return AWS.Route53.Record(`mail-dkim-${position}`, {
      hostedZoneId: zone,
      name: Output.map(record, ({ name }: { name: string }) => name),
      type: "CNAME",
      records: [Output.map(record, ({ value }: { value: string }) => value)],
    }).pipe(Alchemy.AdoptPolicy.adopt(true), Alchemy.RemovalPolicy.retain());
  });

  return identity;
});
