import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";

import { UserId } from "@/globals/application/ddd/ids/user-id";
import { Criteria } from "@/globals/application/ddd/specification";

import { SessionId } from "./session.id";
import { SessionRootOps } from "./session.root-ops";
import { SessionSpecifications } from "./session.specification";

const sessionId = SessionId.make("11111111-1111-1111-1111-111111111111");
const otherId = SessionId.make("22222222-2222-2222-2222-222222222222");
const userId = UserId.make("33333333-3333-3333-3333-333333333333");
const now = DateTime.makeUnsafe("2025-01-01T00:00:00Z");

const session = SessionRootOps.create({
  id: sessionId,
  userId,
  subject: "subject-1",
  now,
  ttlSeconds: 3600,
  absoluteTtlSeconds: 43200,
});

describe("SessionSpecifications.withId", () => {
  it("matches the session with the given id and no other", () => {
    deepStrictEqual(SessionSpecifications.withId(sessionId)(session), true);
    deepStrictEqual(SessionSpecifications.withId(otherId)(session), false);
  });

  it("carries an Eq criteria over the id column", () => {
    deepStrictEqual(
      SessionSpecifications.withId(sessionId).criteria,
      Criteria.Eq({ field: "id", value: sessionId }),
    );
  });
});
