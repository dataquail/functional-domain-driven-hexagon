import { assert, describe, it } from "@effect/vitest";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";

import * as Builder from "./builder.js";
import * as Module from "./module.js";

class Platform extends Context.Service<Platform, { readonly stamp: string }>()("test/Platform") {}

class Role extends Context.Service<Role, { readonly of: (name: string) => string }>()(
  "test/Role",
) {}

class User extends Context.Service<User, { readonly greet: string }>()("test/User") {}

class Buildings extends Context.Service<Buildings, { readonly order: Ref.Ref<Array<string>> }>()(
  "test/Buildings",
) {}

const BuildingsLive = Layer.effect(
  Buildings,
  Effect.map(Ref.make<Array<string>>([]), (order) => Buildings.of({ order })),
);

const PlatformLive = Layer.succeed(Platform, Platform.of({ stamp: "platform" }));

const recording = <A>(name: string, service: A) =>
  Effect.gen(function* () {
    const buildings = yield* Buildings;
    yield* Ref.update(buildings.order, (names) => [...names, name]);
    return service;
  });

const RoleLive = Layer.effect(Role, recording("role", Role.of({ of: (name) => `${name}:role` })));

const UserLive = Layer.effect(
  User,
  Effect.gen(function* () {
    const platform = yield* Platform;
    const role = yield* Role;
    return yield* recording("user", User.of({ greet: role.of(platform.stamp) }));
  }),
);

const roleModule = Module.make("role", RoleLive);
const userModule = Module.make("user", UserLive);

describe("Builder", () => {
  it.effect("resolves a module against the modules added before it", () =>
    Effect.gen(function* () {
      const app = Builder.app<Platform | Buildings>().add(roleModule).add(userModule).build();

      const user = yield* Effect.provide(
        User,
        app.layer.pipe(Layer.provide(Layer.mergeAll(PlatformLive, BuildingsLive))),
      );

      assert.strictEqual(user.greet, "platform:role");
    }),
  );

  it.effect("keeps every added module in the success channel", () =>
    Effect.gen(function* () {
      const app = Builder.app<Platform | Buildings>().add(roleModule).add(userModule).build();

      const role = yield* Effect.provide(
        Role,
        app.layer.pipe(Layer.provide(Layer.mergeAll(PlatformLive, BuildingsLive))),
      );

      assert.strictEqual(role.of("x"), "x:role");
    }),
  );

  it.effect("builds each module once, in the order it was added", () =>
    Effect.gen(function* () {
      const app = Builder.app<Platform | Buildings>().add(roleModule).add(userModule).build();

      const built = yield* Effect.provide(
        Effect.gen(function* () {
          yield* User;
          yield* Role;
          const buildings = yield* Buildings;
          return yield* Ref.get(buildings.order);
        }),
        app.layer.pipe(Layer.provideMerge(Layer.mergeAll(PlatformLive, BuildingsLive))),
      );

      assert.deepStrictEqual(built, ["role", "user"]);
    }),
  );

  it("records the module names in order", () => {
    const app = Builder.app<Platform | Buildings>().add(roleModule).add(userModule).build();
    assert.deepStrictEqual(app.names, ["role", "user"]);
  });

  it.effect("merges every module's http layer as a peer", () =>
    Effect.gen(function* () {
      const app = Builder.app<Platform>()
        .add(
          Module.make("a", Layer.empty, { http: Layer.succeed(Role, Role.of({ of: (n) => n })) }),
        )
        .add(Module.make("b", Layer.empty, { http: Layer.succeed(User, User.of({ greet: "b" })) }))
        .build();

      const greet = yield* Effect.provide(
        Effect.map(User, (user) => user.greet),
        app.http,
      );

      assert.strictEqual(greet, "b");
    }),
  );

  it.effect("merges every module's httpDeps as a peer", () =>
    Effect.gen(function* () {
      const app = Builder.app<Platform>()
        .add(
          Module.make("a", Layer.empty, {
            httpDeps: Layer.succeed(Role, Role.of({ of: (n) => `${n}!` })),
          }),
        )
        .add(Module.make("b", Layer.empty))
        .build();

      const shout = yield* Effect.provide(
        Effect.map(Role, (role) => role.of("hi")),
        app.httpDeps,
      );

      assert.strictEqual(shout, "hi!");
    }),
  );

  // The guards below are the point of the builder, and a guard written the
  // obvious way resolves its conditional at the parameter's constraint and
  // silently admits everything. `@ts-expect-error` is the probe: if a guard
  // stops firing, the directive becomes unused and `tsc` fails.
  describe("guards", () => {
    it("rejects a module added before the module it requires", () => {
      Builder.app<Platform | Buildings>()
        // @ts-expect-error `user` requires Role, and `role` has not been added
        .add(userModule)
        .add(roleModule);
    });

    it("rejects a module whose requirement is in neither the platform nor a prior module", () => {
      Builder.app<Buildings>()
        .add(roleModule)
        // @ts-expect-error `user` requires Platform, which was not declared
        .add(userModule);
    });

    it("rejects the same module name twice", () => {
      Builder.app<Platform | Buildings>()
        .add(roleModule)
        // @ts-expect-error `role` is already in the application
        .add(Module.make("role", Layer.empty));
    });

    it("admits a module whose requirements are all satisfied", () => {
      Builder.app<Platform | Buildings>().add(roleModule).add(userModule).build();
    });
  });
});
