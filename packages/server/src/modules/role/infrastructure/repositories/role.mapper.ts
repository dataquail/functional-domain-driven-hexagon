import { type RowSchemas } from "@org/database/index";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { UserId } from "@/globals/application/ddd/ids/user-id.ts";
import { type ColumnMap } from "@/globals/infrastructure/database/criteria-to-sql.ts";
import { RoleValueObject } from "@/modules/role/domain/roles/role.value-object.ts";
import { RolesRoot } from "@/modules/role/domain/roles/roles.root.ts";

type Row = RowSchemas.PlatformRoleRow;

const decodeRole = Schema.decodeUnknownOption(RoleValueObject);

// Field → column map for spec translation. Only `userId` is filterable; `roles`
// is a child collection with no scalar column, which is why `hasRole` stays an
// eval-only Predicate and never reaches this map.
export const columns = {
  userId: "user_id",
} as const satisfies Partial<Record<keyof RolesRoot, string>> & ColumnMap;

// Reconstitutes ONE aggregate from the rows the repository fetched for a single
// user. Zero rows → `None`; the caller decides that "no rows" means an empty
// aggregate. Identity is read from the rows themselves — every row carries
// `user_id`. Unknown role strings (never inserted by application code) are
// filtered out rather than crashing the read.
export const toDomain = (rows: ReadonlyArray<Row>): Option.Option<RolesRoot> =>
  Option.map(Arr.head(rows), (first) =>
    RolesRoot.make({
      userId: UserId.make(first.user_id),
      roles: Arr.getSomes(rows.map((r) => decodeRole(r.role))),
    }),
  );
