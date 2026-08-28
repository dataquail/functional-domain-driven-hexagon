import { Database, RowSchemas } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { WalletAlreadyExistsForOrganization } from "@/modules/wallet/domain/wallet/wallet.errors.js";
import { WalletRepository } from "@/modules/wallet/domain/wallet/wallet.repository.js";
import { type WalletRoot } from "@/modules/wallet/domain/wallet/wallet.root.js";
import { type Specification } from "@/platform/ddd/contracts/specification.js";
import { criteriaToWhere } from "@/platform/persistence/criteria-to-sql.js";
import {
  translateDatabaseErrors,
  translatePersistenceUnavailable,
} from "@/platform/translate-database-errors.js";

import * as WalletMapper from "./wallet.mapper.js";

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
        Effect.catchTag("DatabaseError", (e) =>
          e.type === "unique_violation"
            ? new WalletAlreadyExistsForOrganization({
                organizationId: wallet.organizationId,
              })
            : Effect.die(e),
        ),
        translatePersistenceUnavailable,
      );
    });

    // The spec contributes only the WHERE; the repository owns FROM, projection,
    // and the `LIMIT 1` (every spec used with findOne selects at most one row —
    // the unique organization_id index guarantees at most one wallet per org).
    const findOne = Effect.fn("WalletRepository.findOne")((spec: Specification<WalletRoot>) =>
      sql`
          SELECT * FROM wallet.wallets
          WHERE ${criteriaToWhere(sql, spec.criteria, WalletMapper.columns)}
          LIMIT 1
        `.pipe(
        Database.maybeRow(RowSchemas.WalletRow),

        Effect.map((row) => (row === null ? null : WalletMapper.toDomain(row))),
        translateDatabaseErrors,
      ),
    );

    return WalletRepository.of({ insertOne, findOne });
  }),
);
