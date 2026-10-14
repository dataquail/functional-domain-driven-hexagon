import { deepStrictEqual } from "node:assert";

import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { UserId } from "@/globals/application/ddd/ids/user-id.ts";
import { UserRepository } from "@/modules/user/domain/user/user.repository.ts";
import { UserRootOps } from "@/modules/user/domain/user/user.root-ops.ts";
import { UserRepositoryLive } from "@/modules/user/infrastructure/repositories/user.repository-live.ts";
import { findUserIdByEmailHandler } from "@/modules/user/queries/find-user-id-by-email.handler.ts";
import { describeIntegration } from "@/test-utils/server-test-runtime.ts";
import { TestDatabaseLive } from "@/test-utils/test-database.ts";

const adaId = UserId.make("11111111-1111-1111-1111-111111111111");
const now = DateTime.makeUnsafe("2025-01-01T00:00:00Z");

const TestLayer = UserRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));

describeIntegration(
  "findUserIdByEmailHandler (integration)",
  { layer: TestLayer, tables: ["user.users"] },
  (it) => {
    it.effect("answers with the id of the user registered under that email", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository;
        yield* repo.insertOne(
          UserRootOps.create({ id: adaId, email: "ada@example.com", address: Option.none(), now })
            .user,
        );

        deepStrictEqual(yield* findUserIdByEmailHandler({ email: "ada@example.com" }), adaId);
      }),
    );

    it.effect("answers null when no user has that email", () =>
      Effect.gen(function* () {
        const found = yield* findUserIdByEmailHandler({ email: "nobody@example.com" });
        deepStrictEqual(Option.fromNullOr(found), Option.none());
      }),
    );
  },
);
