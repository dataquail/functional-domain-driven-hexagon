import * as DateTime from "effect/DateTime";

export type StageKind = "long-lived" | "preview";

export type WorkerRole = "web" | "identity" | "server";

export type StageHosts = {
  readonly appUrl: string;
  readonly identityUrl: string;
  readonly appHostname: string | undefined;
  readonly identityHostname: string | undefined;
};

export type HostSettings = {
  readonly appDomain: string | undefined;
  readonly workersSubdomain: string | undefined;
};

export const PRODUCTION_STAGE = "prod";

const LONG_LIVED_STAGES: ReadonlySet<string> = new Set([PRODUCTION_STAGE, "staging"]);

export const PREVIEW_PARENT_STAGE = "staging";

const PREVIEW_BRANCH_LIFETIME = { days: 7 };

export const kindOfStage = (stage: string): StageKind =>
  LONG_LIVED_STAGES.has(stage) ? "long-lived" : "preview";

export const previewBranchExpiresAt = (now: DateTime.Utc): string =>
  DateTime.formatIso(DateTime.add(now, PREVIEW_BRANCH_LIFETIME));

export const workerName = (stage: string, role: WorkerRole): string =>
  `hexagon-${stage.toLowerCase().replace(/[^a-z0-9-]/g, "-")}-${role}`;

const domainHostnames = (stage: string, appDomain: string) => {
  const prefix = stage === PRODUCTION_STAGE ? "" : `${stage}.`;
  return { app: `app.${prefix}${appDomain}`, identity: `auth.${prefix}${appDomain}` };
};

const workersDevUrl = (stage: string, role: WorkerRole, workersSubdomain: string): string =>
  `https://${workerName(stage, role)}.${workersSubdomain}.workers.dev`;

const missing = (name: string, stage: string): never => {
  throw new Error(`${name} is required to deploy stage '${stage}'`);
};

// Long-lived stages answer on the domain; previews on workers.dev, so a pull
// request never touches DNS.
export const stageHosts = (stage: string, settings: HostSettings): StageHosts => {
  if (kindOfStage(stage) === "long-lived") {
    const { app, identity } = domainHostnames(
      stage,
      settings.appDomain ?? missing("APP_DOMAIN", stage),
    );
    return {
      appUrl: `https://${app}`,
      identityUrl: `https://${identity}`,
      appHostname: app,
      identityHostname: identity,
    };
  }
  const subdomain = settings.workersSubdomain ?? missing("CLOUDFLARE_WORKERS_SUBDOMAIN", stage);
  return {
    appUrl: workersDevUrl(stage, "web", subdomain),
    identityUrl: workersDevUrl(stage, "identity", subdomain),
    appHostname: undefined,
    identityHostname: undefined,
  };
};

export const identityIssuer = (hosts: StageHosts): string => `${hosts.identityUrl}/api/auth`;

export const appCallbackUrl = (hosts: StageHosts): string => `${hosts.appUrl}/api/auth/callback`;

export const appSignedOutUrl = (hosts: StageHosts): string => `${hosts.appUrl}/`;
