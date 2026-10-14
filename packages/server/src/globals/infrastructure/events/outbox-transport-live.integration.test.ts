import { deepStrictEqual, ok } from "node:assert";

import { assertDefined, assertTrue } from "@effect/vitest/utils";
import { CommandBus, Event, EventBus } from "@effect-server-utils/cqrs";
import { deliverOnce, withUnitOfWork } from "@effect-server-utils/unit-of-work";
import { Database, RowSchemas } from "@org/database/index";
import * as Arr from "effect/Array";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Logger from "effect/Logger";
import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";
import * as Tracer from "effect/Tracer";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id";
import { sweepOutbox, toEnvelope } from "@/globals/infrastructure/events/outbox-sweeper";
import { CreateOrganizationCommand } from "@/modules/organization/commands/create-organization.command";
import { InviteUserCommand } from "@/modules/organization/commands/invite-user.command";
import { MEMBER_CALLER_ID } from "@/test-utils/fake-auth-middleware";
import { describeServer } from "@/test-utils/server-test-runtime";

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
    VALUES (${ORG_ID}, 'Acme', now(), now(), NULL)
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
    const logs: Array<string> = [];
    const spans: Array<Tracer.NativeSpan> = [];

    const tracer = Tracer.make({
      span: (options) => {
        const span = new Tracer.NativeSpan(options);
        spans.push(span);

        return span;
      },
    });

    const logger = Logger.make(({ message }) => {
      const [first] = Arr.ensure(message);

      if (Predicate.isString(first)) logs.push(first);
    });

    const result = yield* effect.pipe(Effect.withTracer(tracer), Effect.withLogger(logger));

    const statements = Arr.getSomes(
      spans.map((span) =>
        Option.liftPredicate(span.attributes.get("db.query.text"), Predicate.isString),
      ),
    );

    return { result, logs, statements };
  });

const emailsIn = (logs: ReadonlyArray<string>) => logs.filter((line) => line === "Mailer.send");

const OUTBOX_TABLES = [
  "platform.event_outbox",
  "platform.event_deliveries",
  "organization.invitations",
  "organization.memberships",
  "organization.organization_roles",
  "organization.organizations",
  "wallet.wallets",
  "platform.roles",
  "user.users",
] as const;

const relayedAt = (row: RowSchemas.EventOutboxRow) => Option.fromNullOr(row.relayed_at);

describeServer(
  "the durable after-commit outbox (integration)",
  { tables: OUTBOX_TABLES, seedSuperAdminCaller: true },
  (it) => {
    it.effect(
      "commits an invitation's outbox row and sends one email, however often it is delivered",
      () =>
        Effect.gen(function* () {
          yield* seedOrg;

          const { logs } = yield* observed(
            Effect.gen(function* () {
              yield* invite;
              const [row] = yield* outboxRows;
              assertDefined(row);
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
          const [relayed] = rows;
          assertDefined(relayed);
          assertTrue(Option.isSome(relayedAt(relayed)));
        }),
    );

    it.effect(
      "leaves a failed delivery's row for the sweeper, which delivers it once the consumer recovers",
      () =>
        Effect.gen(function* () {
          const bus = yield* EventBus;
          const failing = yield* Ref.make(true);
          const handled = yield* Ref.make(0);
          const Probe = Event.make("OutboxSweeperProbe", { id: Schema.String });
          yield* bus.subscribeAfterCommit(
            Probe,
            () =>
              Effect.flatMap(Ref.get(failing), (fail) => {
                if (fail) return Effect.die("consumer down");

                return Ref.update(handled, (n) => n + 1);
              }),
            { name: "test.outboxSweeperProbe" },
          );

          yield* withUnitOfWork(bus.dispatch([Probe.make({ id: "a" })]));

          const [failed] = yield* outboxRows;
          assertDefined(failed);
          assertTrue(Option.isNone(relayedAt(failed)));
          deepStrictEqual(failed.attempts, 1);
          deepStrictEqual(yield* Ref.get(handled), 0);

          yield* Ref.set(failing, false);
          deepStrictEqual(yield* sweepOutbox(Duration.zero), 1);

          const [swept] = yield* outboxRows;
          assertDefined(swept);
          assertTrue(Option.isSome(relayedAt(swept)));
          deepStrictEqual(swept.attempts, 2);
          deepStrictEqual(yield* Ref.get(handled), 1);
          deepStrictEqual(yield* sweepOutbox(Duration.zero), 0);
        }),
    );

    it.effect(
      "touches neither outbox table for a command whose events no after-commit subscription answers",
      () =>
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

    it.effect(
      "writes exactly one outbox row inside the transaction of a command that does publish one",
      () =>
        Effect.gen(function* () {
          yield* seedOrg;
          const { statements } = yield* observed(invite);

          deepStrictEqual(
            statements.filter((text) => /INSERT INTO platform\.event_outbox/.test(text)).length,
            1,
          );
        }),
    );
  },
);
