import { Database, RowSchemas, sql } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { type OrganizationId } from "@/platform/ids/organization-id.js";
import { translatePersistenceUnavailable } from "@/platform/translate-persistence-unavailable.js";

import { WalletRepository } from "../domain/ports/repositories/wallet-repository.js";
import { type Wallet } from "../domain/wallet.aggregate.js";
import { WalletAlreadyExistsForOrganization } from "../domain/wallet-errors.js";
import * as WalletMapper from "./wallet-mapper.js";

export const WalletRepositoryLive = Layer.effect(
  WalletRepository,
  Effect.gen(function* () {
    const db = yield* Database.Database;

    const insert = db.makeQuery((execute, wallet: Wallet) => {
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
        Effect.withSpan("WalletRepository.insert"),
      );
    });

    const findByOrganizationId = db.makeQuery((execute, organizationId: OrganizationId) =>
      execute((client) =>
        client.maybeOne(sql.type(RowSchemas.WalletRowStd)`
          SELECT * FROM wallet.wallets WHERE organization_id = ${organizationId}
        `),
      ).pipe(
        Effect.map((row) =>
          row === null ? Option.none() : Option.some(WalletMapper.toDomain(row)),
        ),
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("WalletRepository.findByOrganizationId"),
      ),
    );

    return WalletRepository.of({ insert, findByOrganizationId });
  }),
);
