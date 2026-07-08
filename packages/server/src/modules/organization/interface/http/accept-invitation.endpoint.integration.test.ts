import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";
import { describe, it } from "@effect/vitest";
import { Database, sql } from "@org/database/index";
import { deepStrictEqual, ok } from "assert";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";

import { Api } from "@/api.js";
import { MEMBER_CALLER_ID } from "@/test-utils/fake-auth-middleware.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";
import { TestServerLiveAsMember } from "@/test-utils/test-server.js";

const suite = describe.sequential;

const ORG_ID = "11111111-1111-1111-1111-111111111111" as never;

const seedOrg = Effect.gen(function* () {
  const db = yield* Database.Database;
  yield* db
    .execute((c) =>
      c.query(sql.unsafe`
        INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
        VALUES (${ORG_ID}, 'Acme', now(), now(), null)
      `),
    )
    .pipe(Effect.orDie);
});

// The invite endpoint doesn't return the raw token (it's a bearer credential
// e-mailed to the invitee), and inviting requires an admin caller while
// accepting requires the invitee's own (non-super-admin) session. Seeding the
// invitation row directly with a known token is the honest seam for the
// cross-caller accept flow — mirrors how the sibling tests seed the org row.
const iso = (offsetMs: number): string => new Date(Date.now() + offsetMs).toISOString();
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const seedInvitation = (
  token: string,
  overrides: { acceptedAt?: string; revokedAt?: string; expiresAt?: string } = {},
) =>
  Effect.gen(function* () {
    const db = yield* Database.Database;
    const expiresAt = overrides.expiresAt ?? iso(SEVEN_DAYS_MS);
    yield* db
      .execute((c) =>
        c.query(sql.unsafe`
          INSERT INTO "organization".invitations
            (organization_id, invitee_email, token, expires_at, accepted_at, revoked_at, created_at)
          VALUES (
            ${ORG_ID}, 'alice@example.com', ${token}, ${expiresAt},
            ${overrides.acceptedAt ?? null},
            ${overrides.revokedAt ?? null},
            now()
          )
        `),
      )
      .pipe(Effect.orDie);
  });

// Accepting provisions a membership keyed to CurrentUser — a super-admin can't
// own an org, so the invitee session is the member-caller variant.
suite("POST /invitations/:token/accept (integration, member caller)", () => {
  const { run } = useServerTestRuntime(
    [
      "organization.invitations",
      "organization.memberships",
      "organization.organizations",
      "user.users",
    ],
    { server: TestServerLiveAsMember, seedSuperAdminCaller: true },
  );

  it("accepts a pending invitation and provisions membership", async () => {
    await run(
      Effect.gen(function* () {
        yield* seedOrg;
        yield* seedInvitation("accept-token-happy-path");
        const client = yield* HttpApiClient.make(Api);

        const { organizationId } = yield* client.invitations.accept({
          path: { token: "accept-token-happy-path" },
        });
        deepStrictEqual(organizationId, ORG_ID);

        const db = yield* Database.Database;
        const membership = yield* db
          .execute((c) =>
            c.query(sql.unsafe`
              SELECT 1 FROM "organization".memberships
              WHERE user_id = ${MEMBER_CALLER_ID} AND organization_id = ${ORG_ID}
            `),
          )
          .pipe(Effect.orDie);
        deepStrictEqual(membership.rowCount, 1);
      }),
    );
  });

  it("returns 404 for an unknown token", async () => {
    await run(
      Effect.gen(function* () {
        yield* seedOrg;
        const client = yield* HttpApiClient.make(Api);
        const exit = yield* Effect.exit(client.invitations.accept({ path: { token: "nope" } }));
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
          deepStrictEqual(exit.cause.error._tag, "InvitationNotFoundError");
        }
      }),
    );
  });

  it("returns 410 Gone for an already-revoked invitation", async () => {
    await run(
      Effect.gen(function* () {
        yield* seedOrg;
        yield* seedInvitation("accept-token-revoked", { revokedAt: "2020-01-01T00:00:00Z" });
        const client = yield* HttpApiClient.make(Api);
        const exit = yield* Effect.exit(
          client.invitations.accept({ path: { token: "accept-token-revoked" } }),
        );
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
          const error = exit.cause.error;
          deepStrictEqual(error._tag, "InvitationGoneError");
          deepStrictEqual(error.reason, "revoked");
        }
      }),
    );
  });

  it("returns 410 Gone for an expired invitation", async () => {
    await run(
      Effect.gen(function* () {
        yield* seedOrg;
        yield* seedInvitation("accept-token-expired", { expiresAt: iso(-SEVEN_DAYS_MS) });
        const client = yield* HttpApiClient.make(Api);
        const exit = yield* Effect.exit(
          client.invitations.accept({ path: { token: "accept-token-expired" } }),
        );
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
          const error = exit.cause.error;
          deepStrictEqual(error._tag, "InvitationGoneError");
          deepStrictEqual(error.reason, "expired");
        }
      }),
    );
  });
});

// A super-admin session hitting accept must be refused — they don't join orgs.
suite("POST /invitations/:token/accept (integration, super-admin caller)", () => {
  const { run } = useServerTestRuntime(
    [
      "organization.invitations",
      "organization.memberships",
      "organization.organizations",
      "user.users",
    ],
    { seedSuperAdminCaller: true },
  );

  it("refuses a super-admin caller with 409", async () => {
    await run(
      Effect.gen(function* () {
        yield* seedOrg;
        yield* seedInvitation("accept-token-superadmin");
        const client = yield* HttpApiClient.make(Api);
        const exit = yield* Effect.exit(
          client.invitations.accept({ path: { token: "accept-token-superadmin" } }),
        );
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
          deepStrictEqual(exit.cause.error._tag, "SuperAdminCannotOwnOrganizationError");
        }
      }),
    );
  });
});
