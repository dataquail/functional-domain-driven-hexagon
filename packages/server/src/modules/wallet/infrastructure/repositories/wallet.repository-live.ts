import { Database, RowSchemas, sql } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { WalletAlreadyExistsForOrganization } from "@/modules/wallet/domain/wallet/wallet.errors.js";
import { WalletRepository } from "@/modules/wallet/domain/wallet/wallet.repository.js";
import { type WalletRoot } from "@/modules/wallet/domain/wallet/wallet.root.js";
import { type Specification } from "@/platform/ddd/contracts/specification.js";
import { criteriaToWhere } from "@/platform/persistence/criteria-to-sql.js";
import { translatePersistenceUnavailable } from "@/platform/translate-persistence-unavailable.js";

import * as WalletMapper from "./wallet.mapper.js";

export const WalletRepositoryLive = Layer.effect(
  WalletRepository,
  Effect.gen(function* () {
    const db = yield* Database.Database;

    const insertOne = db.makeQuery((execute, wallet: WalletRoot) => {
      const row = WalletMapper.toPersistence(wallet);
      return execute((client) =>
        client.query(sql.unsafe`
          INSERT INTO wallet.wallets (id, organization_id, balance, created_at, updated_at)
          VALUES (
            ${row.id},
            ${row.organization_id},
            ${row.balance},
            ${sql.timestamp(row.created_at)},
            ${sql.timestamp(row.updated_at)}
          )
        `),
      ).pipe(
        Effect.asVoid,
        Effect.catchTag("DatabaseError", (e) =>
          e.type === "unique_violation"
            ? Effect.fail(
                new WalletAlreadyExistsForOrganization({
                  organizationId: wallet.organizationId,
                }),
              )
            : Effect.die(e),
        ),
        translatePersistenceUnavailable,
        Effect.withSpan("WalletRepository.insertOne"),
      );
    });

    // The spec contributes only the WHERE; the repository owns FROM, projection,
    // and the `LIMIT 1` (every spec used with findOne selects at most one row —
    // the unique organization_id index guarantees at most one wallet per org).
    const findOne = db.makeQuery((execute, spec: Specification<WalletRoot>) =>
      execute((client) =>
        client.maybeOne(sql.type(RowSchemas.WalletRowStd)`
          SELECT * FROM wallet.wallets
          WHERE ${criteriaToWhere(spec.criteria, WalletMapper.columns)}
          LIMIT 1
        `),
      ).pipe(
        Effect.map((row) => (row === null ? null : WalletMapper.toDomain(row))),
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("WalletRepository.findOne"),
      ),
    );

    return WalletRepository.of({ insertOne, findOne });
  }),
);
