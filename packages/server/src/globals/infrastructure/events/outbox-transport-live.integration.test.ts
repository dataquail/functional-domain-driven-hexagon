import { deepStrictEqual, ok } from "node:assert";

import { describe, it } from "@effect/vitest";
import { CommandBus, Event, EventBus } from "@effect-server-utils/cqrs";
import { deliverOnce, withUnitOfWork } from "@effect-server-utils/unit-of-work";
import { Database, RowSchemas } from "@org/database/index";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Logger from "effect/Logger";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";
import * as Tracer from "effect/Tracer";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id.js";
import { sweepOutbox, toEnvelope } from "@/globals/infrastructure/events/outbox-sweeper-live.js";
import { CreateOrganizationCommand } from "@/modules/organization/commands/create-organization.command.js";
import { InviteUserCommand } from "@/modules/organization/commands/invite-user.command.js";
import { MEMBER_CALLER_ID } from "@/test-utils/fake-auth-middleware.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";

const ORG_ID = OrganizationId.make("11111111-1111-1111-1111-111111111111");

const outboxRows = Effect.gen(function* () {
  const sql = yield* Database.Database;
  return yield* sql`SELECT * FROM platform.event_outbox ORDER BY occurred_at`.pipe(
    Database.rows(RowSchemas.EventOutboxRow),
    Effect.orDie,
  );
});

const seedOrg = Effect.gen(function* () {
  const sql = yield* Database.Database;
  yield* sql`
    INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
    VALUES (${ORG_ID}, 'Acme', now(), now(), null)
  `.pipe(Effect.orDie);
});

const invite = Effect.gen(function* () {
  const bus = yield* CommandBus;
  return yield* bus.execute(InviteUserCommand, {
    organizationId: ORG_ID,
    inviteeEmail: "alice@example.com",
    ttlSeconds: 3600,
    actorUserId: MEMBER_CALLER_ID,
  });
});

// Runs `effect` with every log line and every SQL statement it produces recorded.
const observed = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    const logs: Array<unknown> = [];
    const spans: Array<Tracer.NativeSpan> = [];
    const tracer = Tracer.make({
      span: (options) => {
        const span = new Tracer.NativeSpan(options);
        spans.push(span);
        return span;
      },
    });
    const logger = Logger.make(({ message }) => {
      logs.push(Array.isArray(message) ? message[0] : message);
    });
    const result = yield* effect.pipe(
      Effect.withTracer(tracer),
      Effect.provide(Logger.layer([logger])),
    );
    const statements = spans.flatMap((span) => {
      const text = span.attributes.get("db.query.text");
      return typeof text === "string" ? [text] : [];
    });
    return { result, logs, statements };
  });

const emailsIn = (logs: ReadonlyArray<unknown>) => logs.filter((line) => line === "Mailer.send");

describe("the durable after-commit outbox (integration)", () => {
  const { run } = useServerTestRuntime(
    [
      "platform.event_outbox",
      "platform.event_deliveries",
      "organization.invitations",
      "organization.memberships",
      "organization.organization_roles",
      "organization.organizations",
      "wallet.wallets",
      "platform.roles",
      "user.users",
    ],
    { seedSuperAdminCaller: true },
  );

  it("commits an invitation's outbox row and sends one email, however often it is delivered", async () => {
    await run(
      Effect.gen(function* () {
        yield* seedOrg;

        const { logs } = yield* observed(
          Effect.gen(function* () {
            yield* invite;
            const [row] = yield* outboxRows;
            ok(row !== undefined);
            const envelope = toEnvelope(row);
            deepStrictEqual(yield* deliverOnce(envelope), Exit.succeed("duplicate"));
            deepStrictEqual(yield* deliverOnce(envelope), Exit.succeed("duplicate"));
          }),
        );

        deepStrictEqual(emailsIn(logs).length, 1);
        const rows = yield* outboxRows;
        deepStrictEqual(
          rows.map(({ attempts, handler, tag }) => ({ tag, handler, attempts })),
          [{ tag: "InvitationIssued", handler: "organization.sendInvitationEmail", attempts: 1 }],
        );
        ok(rows[0]?.relayed_at !== null);
      }),
    );
  });

  it("leaves a failed delivery's row for the sweeper, which delivers it once the consumer recovers", async () => {
    await run(
      Effect.gen(function* () {
        const bus = yield* EventBus;
        const failing = yield* Ref.make(true);
        const handled = yield* Ref.make(0);
        const Probe = Event.make("OutboxSweeperProbe", { id: Schema.String });
        yield* bus.subscribeAfterCommit(
          Probe,
          () =>
            Effect.flatMap(Ref.get(failing), (fail) =>
              fail ? Effect.die("consumer down") : Ref.update(handled, (n) => n + 1),
            ),
          { name: "test.outboxSweeperProbe" },
        );

        yield* withUnitOfWork(bus.dispatch([Probe.make({ id: "a" })]));

        const [failed] = yield* outboxRows;
        ok(failed !== undefined);
        deepStrictEqual(failed.relayed_at, null);
        deepStrictEqual(failed.attempts, 1);
        deepStrictEqual(yield* Ref.get(handled), 0);

        yield* Ref.set(failing, false);
        deepStrictEqual(yield* sweepOutbox(Duration.zero), 1);

        const [swept] = yield* outboxRows;
        ok(swept !== undefined);
        ok(swept.relayed_at !== null);
        deepStrictEqual(swept.attempts, 2);
        deepStrictEqual(yield* Ref.get(handled), 1);
        deepStrictEqual(yield* sweepOutbox(Duration.zero), 0);
      }),
    );
  });

  it("touches neither outbox table for a command whose events no after-commit subscription answers", async () => {
    await run(
      Effect.gen(function* () {
        const bus = yield* CommandBus;
        const { statements } = yield* observed(
          bus.execute(CreateOrganizationCommand, { name: "Acme", actorUserId: MEMBER_CALLER_ID }),
        );

        ok(statements.length > 0);
        deepStrictEqual(
          statements.filter((text) => /event_outbox|event_deliveries/.test(text)),
          [],
        );
        deepStrictEqual(yield* outboxRows, []);
      }),
    );
  });

  it("writes exactly one outbox row inside the transaction of a command that does publish one", async () => {
    await run(
      Effect.gen(function* () {
        yield* seedOrg;
        const { statements } = yield* observed(invite);

        deepStrictEqual(
          statements.filter((text) => /INSERT INTO platform\.event_outbox/.test(text)).length,
          1,
        );
      }),
    );
  });
});
