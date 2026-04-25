import { Database, RowSchemas, sql } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { type UserId } from "../domain/user-id.js";
import { WalletAlreadyExistsForUser } from "../domain/wallet-errors.js";
import { WalletRepository } from "../domain/wallet-repository.js";
import { type Wallet } from "../domain/wallet.js";
import * as WalletMapper from "./wallet-mapper.js";

export const WalletRepositoryLive = Layer.effect(
  WalletRepository,
  Effect.gen(function* () {
    const db = yield* Database.Database;

    const insert = db.makeQuery((execute, wallet: Wallet) => {
      const row = WalletMapper.toPersistence(wallet);
      return execute((client) =>
        client.query(sql.unsafe`
          INSERT INTO wallets (id, user_id, balance, created_at, updated_at)
          VALUES (
            ${row.id},
            ${row.user_id},
            ${row.balance},
            ${sql.timestamp(row.created_at)},
            ${sql.timestamp(row.updated_at)}
          )
        `),
      ).pipe(
        Effect.asVoid,
        Effect.catchTag("DatabaseError", (e) =>
          e.type === "unique_violation"
            ? Effect.fail(new WalletAlreadyExistsForUser({ userId: wallet.userId }))
            : Effect.die(e),
        ),
        Effect.withSpan("WalletRepository.insert"),
      );
    });

    const findByUserId = db.makeQuery((execute, userId: UserId) =>
      execute((client) =>
        client.maybeOne(sql.type(RowSchemas.WalletRowStd)`
          SELECT * FROM wallets WHERE user_id = ${userId}
        `),
      ).pipe(
        Effect.map((row) =>
          row === null ? Option.none() : Option.some(WalletMapper.toDomain(row)),
        ),
        Effect.catchTag("DatabaseError", Effect.die),
        Effect.withSpan("WalletRepository.findByUserId"),
      ),
    );

    return WalletRepository.of({ insert, findByUserId });
  }),
);
