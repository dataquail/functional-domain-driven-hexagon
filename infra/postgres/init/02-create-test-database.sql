-- Peer database for the integration suite (`*.integration.test.ts` reads
-- DATABASE_URL_TEST). Same one-shot contract as 01: init scripts only fire on
-- a brand-new data directory. Migrations are applied separately, via
-- `pnpm --filter @org/database db:migrate:test`.
CREATE DATABASE "effect-monorepo-test";
