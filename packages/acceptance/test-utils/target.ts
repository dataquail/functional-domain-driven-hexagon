import * as Option from "effect/Option";

// Where the suite runs: a stack it boots itself under `alchemy dev`, or a
// preview stage already deployed (`ACCEPTANCE_BASE_URL`).
export type AcceptanceTarget =
  | { readonly kind: "local"; readonly appUrl: string; readonly databaseUrl: string }
  | {
      readonly kind: "deployed";
      readonly appUrl: string;
      readonly databaseUrl: string;
      readonly stage: string;
    };

type Env = NodeJS.ProcessEnv;

const LOCAL_APP_URL = "http://localhost:3000";

const LOCAL_TEST_DATABASE_URL =
  "postgresql://postgres:postgres@localhost:5432/effect-monorepo-test";

const PREVIEW_STAGE = /^pr-\d+$/;

const nonEmpty = (env: Env, name: string): Option.Option<string> =>
  Option.fromUndefinedOr(env[name]).pipe(Option.filter((value) => value !== ""));

const requiredFor = (env: Env, name: string, reason: string): string =>
  Option.getOrThrowWith(
    nonEmpty(env, name),
    () => new Error(`[acceptance] ${name} is required ${reason}`),
  );

const databaseName = (url: string): string => new URL(url).pathname.replace(/^\//, "");

const deployedTarget = (env: Env, appUrl: string): AcceptanceTarget => {
  const reason = "when ACCEPTANCE_BASE_URL targets a deployed stage";
  const stage = requiredFor(env, "ACCEPTANCE_STAGE", reason);

  // The suite truncates tables, so only a throwaway preview branch may be its target.
  if (!PREVIEW_STAGE.test(stage)) {
    throw new Error(`[acceptance] refusing to run against stage '${stage}': only pr-<n> stages`);
  }

  return {
    kind: "deployed",
    appUrl: appUrl.replace(/\/$/, ""),
    databaseUrl: requiredFor(env, "ACCEPTANCE_DATABASE_URL", reason),
    stage,
  };
};

const localTarget = (env: Env): AcceptanceTarget => {
  const databaseUrl = Option.getOrElse(
    nonEmpty(env, "DATABASE_URL_TEST"),
    () => LOCAL_TEST_DATABASE_URL,
  );

  if (!databaseName(databaseUrl).toLowerCase().includes("test")) {
    throw new Error(
      `[acceptance] refusing to operate on '${databaseName(databaseUrl)}' — DATABASE_URL_TEST name must contain 'test'`,
    );
  }

  const appUrl = Option.getOrElse(nonEmpty(env, "APP_URL"), () => LOCAL_APP_URL);

  return { kind: "local", appUrl, databaseUrl };
};

export const acceptanceTarget = (env: Env = process.env): AcceptanceTarget =>
  Option.match(nonEmpty(env, "ACCEPTANCE_BASE_URL"), {
    onNone: () => localTarget(env),
    onSome: (baseUrl) => deployedTarget(env, baseUrl),
  });
