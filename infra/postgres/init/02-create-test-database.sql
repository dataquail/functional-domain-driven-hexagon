-- Peer database for the integration suite (`*.integration.test.ts` reads
-- DATABASE_URL_TEST). Init scripts only fire on a brand-new data directory;
-- migrations are applied separately, via `pnpm --filter @org/database db:migrate:test`.
CREATE DATABASE "effect-monorepo-test";
