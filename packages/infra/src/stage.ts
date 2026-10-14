import * as DateTime from "effect/DateTime";

export type StageKind = "long-lived" | "preview";

const LONG_LIVED_STAGES: ReadonlySet<string> = new Set(["prod", "staging"]);

export const PREVIEW_PARENT_STAGE = "staging";

const PREVIEW_BRANCH_LIFETIME = { days: 7 };

export const kindOfStage = (stage: string): StageKind =>
  LONG_LIVED_STAGES.has(stage) ? "long-lived" : "preview";

export const previewBranchExpiresAt = (now: DateTime.Utc): string =>
  DateTime.formatIso(DateTime.add(now, PREVIEW_BRANCH_LIFETIME));
