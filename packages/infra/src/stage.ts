import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

export type StageKind = "long-lived" | "preview";

export type WorkerRole = "web" | "identity" | "server";

export type StageHosts = {
  readonly appUrl: string;
  readonly identityUrl: string;
  readonly appHostname: Option.Option<string>;
  readonly identityHostname: Option.Option<string>;
};

export type HostSettings = {
  readonly appDomain: Option.Option<string>;
  readonly workersSubdomain: Option.Option<string>;
};

export const PRODUCTION_STAGE = "prod";

const LONG_LIVED_STAGES: ReadonlySet<string> = new Set([PRODUCTION_STAGE, "staging"]);

export const PREVIEW_PARENT_STAGE = "staging";

const PREVIEW_BRANCH_LIFETIME = { days: 7 };

export const kindOfStage = (stage: string): StageKind => {
  if (LONG_LIVED_STAGES.has(stage)) return "long-lived";

  return "preview";
};

export const previewBranchExpiresAt = (now: DateTime.Utc): string =>
  DateTime.formatIso(DateTime.add(now, PREVIEW_BRANCH_LIFETIME));

export const workerName = (stage: string, role: WorkerRole): string =>
  `hexagon-${stage.toLowerCase().replace(/[^a-z0-9-]/g, "-")}-${role}`;

const stagePrefix = (stage: string): string => {
  if (stage === PRODUCTION_STAGE) return "";

  return `${stage}.`;
};

const domainHostnames = (stage: string, appDomain: string) => {
  const prefix = stagePrefix(stage);

  return { app: `app.${prefix}${appDomain}`, identity: `auth.${prefix}${appDomain}` };
};

const workersDevUrl = (stage: string, role: WorkerRole, workersSubdomain: string): string =>
  `https://${workerName(stage, role)}.${workersSubdomain}.workers.dev`;

export class StageSettingMissing extends Schema.TaggedError<
  StageSettingMissing,
  { readonly brand: "StageSettingMissing" }
>()("StageSettingMissing", { setting: Schema.String, stage: Schema.String }) {}

const required = (setting: string, stage: string, value: Option.Option<string>) =>
  Result.fromOption(value, () => new StageSettingMissing({ setting, stage }));

const domainHosts = (stage: string, appDomain: string): StageHosts => {
  const { app, identity } = domainHostnames(stage, appDomain);

  return {
    appUrl: `https://${app}`,
    identityUrl: `https://${identity}`,
    appHostname: Option.some(app),
    identityHostname: Option.some(identity),
  };
};

const workersDevHosts = (stage: string, subdomain: string): StageHosts => ({
  appUrl: workersDevUrl(stage, "web", subdomain),
  identityUrl: workersDevUrl(stage, "identity", subdomain),
  appHostname: Option.none(),
  identityHostname: Option.none(),
});

// Long-lived stages answer on the domain; previews on workers.dev, so a pull
// request never touches DNS.
export const stageHosts = (
  stage: string,
  settings: HostSettings,
): Result.Result<StageHosts, StageSettingMissing> => {
  if (kindOfStage(stage) === "long-lived") {
    return Result.map(required("APP_DOMAIN", stage, settings.appDomain), (appDomain) =>
      domainHosts(stage, appDomain),
    );
  }

  return Result.map(
    required("CLOUDFLARE_WORKERS_SUBDOMAIN", stage, settings.workersSubdomain),
    (subdomain) => workersDevHosts(stage, subdomain),
  );
};

export const identityIssuer = (hosts: StageHosts): string => `${hosts.identityUrl}/api/auth`;

export const appCallbackUrl = (hosts: StageHosts): string => `${hosts.appUrl}/api/auth/callback`;

export const appSignedOutUrl = (hosts: StageHosts): string => `${hosts.appUrl}/`;

// The entry when the value is present: an absent setting is left out of a Worker's
// env or the stack's outputs rather than set empty.
export const presentEntry = <Entry>(
  value: Option.Option<string>,
  entry: (present: string) => Entry,
): Partial<Entry> => Option.match(value, { onNone: () => ({}), onSome: entry });
