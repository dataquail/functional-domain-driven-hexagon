import type { ExecutionContext, Hyperdrive, SendEmail } from "@cloudflare/workers-types";
import * as Effect from "effect/Effect";
import pg from "pg";

import { type ClientCredentials, makeIdentityAuth } from "../../auth/identity-auth.js";
import { betterAuthPort } from "../../auth/identity-auth-port.js";
import { handleIdentityRequest } from "../../http/identity-router.js";
import { emailBindingMailer } from "../../mail/email-binding-mailer.js";
import type { IdentityMailer, MailSender } from "../../mail/identity-mailer.js";
import { mailpitMailer } from "../../mail/mailpit-mailer.js";

type IdentityWorkerEnv = {
  readonly IDENTITY_DB: Hyperdrive;
  readonly BETTER_AUTH_SECRET: string;
  readonly IDENTITY_BASE_URL: string;
  readonly APP_URL: string;
  readonly IDENTITY_MAILER: "mailpit" | "cloudflare";
  readonly IDENTITY_MAIL_FROM_ADDRESS: string;
  readonly IDENTITY_MAIL_FROM_NAME: string;
  readonly MAILPIT_URL?: string;
  readonly EMAIL?: SendEmail;
  readonly IDENTITY_SEED_TOKEN?: string;
};

const mailerFor = (env: IdentityWorkerEnv): IdentityMailer => {
  const sender: MailSender = {
    address: env.IDENTITY_MAIL_FROM_ADDRESS,
    name: env.IDENTITY_MAIL_FROM_NAME,
  };
  if (env.IDENTITY_MAILER === "cloudflare") {
    if (env.EMAIL === undefined)
      throw new Error("IDENTITY_MAILER=cloudflare needs the EMAIL binding");
    return emailBindingMailer(env.EMAIL, sender);
  }
  if (env.MAILPIT_URL === undefined) throw new Error("IDENTITY_MAILER=mailpit needs MAILPIT_URL");
  return mailpitMailer({ url: env.MAILPIT_URL, sender });
};

export default {
  fetch(request: Request, env: IdentityWorkerEnv, ctx: ExecutionContext): Promise<Response> {
    // Hyperdrive pools connections itself; a pool that outlives the request would hold a dead socket.
    const database = new pg.Pool({ connectionString: env.IDENTITY_DB.connectionString, max: 1 });
    const backgroundTasks: Array<Promise<unknown>> = [];
    const settingsFor = (registerClientAs?: ClientCredentials) => ({
      baseUrl: env.IDENTITY_BASE_URL,
      secret: env.BETTER_AUTH_SECRET,
      appUrl: env.APP_URL,
      database,
      mailer: mailerFor(env),
      runInBackground: (task: Promise<unknown>) => backgroundTasks.push(task),
      ...(registerClientAs === undefined ? {} : { registerClientAs }),
    });
    const closeDatabaseAfterBackgroundTasks = Effect.sync(() => {
      ctx.waitUntil(Promise.allSettled(backgroundTasks).then(() => database.end()));
    });
    return Effect.runPromise(
      handleIdentityRequest(request, {
        auth: betterAuthPort(
          () => makeIdentityAuth(settingsFor()),
          (client) => makeIdentityAuth({ ...settingsFor(client), sendVerificationOnSignUp: false }),
        ),
        appUrl: env.APP_URL,
        seedToken: env.IDENTITY_SEED_TOKEN,
      }).pipe(Effect.ensuring(closeDatabaseAfterBackgroundTasks)),
    );
  },
};
