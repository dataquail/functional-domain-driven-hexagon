import { runMigrations } from "./test-utils/database";

// Runs once before any spec, before the Playwright webServer starts. Drops
// and replays migrations against the test DB so the API server boots into
// a known schema. Per-test truncation happens in spec/before hooks.
export default async (): Promise<void> => {
  const url =
    process.env.DATABASE_URL_TEST ??
    "postgresql://postgres:postgres@localhost:5432/effect-monorepo-test";
  await runMigrations(url);
};
