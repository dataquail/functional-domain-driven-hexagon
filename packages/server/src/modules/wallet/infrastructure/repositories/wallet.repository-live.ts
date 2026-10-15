import { Database, RowSchemas } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { type Specification } from "@/globals/application/ddd/specification";
import { criteriaToWhere } from "@/globals/infrastructure/database/criteria-to-sql";
import {
  translateDatabaseErrors,
  translatePersistenceUnavailable,
} from "@/globals/infrastructure/database/translate-database-errors";
import { WalletAlreadyExistsForOrganization } from "@/modules/wallet/domain/wallet/wallet.errors";
import { WalletRepository } from "@/modules/wallet/domain/wallet/wallet.repository";
import { type WalletRoot } from "@/modules/wallet/domain/wallet/wallet.root";

import * as WalletMapper from "./wallet.mapper";

export const WalletRepositoryLive = Layer.effect(
  WalletRepository,
  Effect.gen(function* () {
    const sql = yield* Database.Database;

    const insertOne = Effect.fn("WalletRepository.insertOne")((wallet: WalletRoot) => {
      const row = WalletMapper.toPersistence(wallet);

      return sql`
          INSERT INTO wallet.wallets (id, organization_id, balance, created_at, updated_at)
          VALUES (
            ${row.id},
            ${row.organization_id},
            ${row.balance},
            ${row.created_at},
            ${row.updated_at}
          )
        `.pipe(
        Database.exec,
        Effect.catchTag("DatabaseError", (e) => {
          if (e.type === "unique_violation") {
            return Effect.fail(
              new WalletAlreadyExistsForOrganization({ organizationId: wallet.organizationId }),
            );
          }

          return Effect.die(e);
        }),
        translatePersistenceUnavailable,
      );
    });

    // The spec contributes only the WHERE; the repository owns FROM, projection,
    // and the `LIMIT 1` (every spec used with findOne selects at most one row —
    // the unique organization_id index guarantees at most one wallet per org).
    const findOne = Effect.fn("WalletRepository.findOne")((spec: Specification<WalletRoot>) =>
      criteriaToWhere(sql, spec.criteria, WalletMapper.columns).pipe(
        Effect.flatMap(
          (where) => sql`
          SELECT * FROM wallet.wallets
          WHERE ${where}
          LIMIT 1
        `,
        ),
        Database.maybeRow(RowSchemas.WalletRow),

        Effect.map(Option.map(WalletMapper.toDomain)),
        translateDatabaseErrors,
      ),
    );

    return WalletRepository.of({ insertOne, findOne });
  }),
);
