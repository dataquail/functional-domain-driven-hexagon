-- Runs once when the postgres container's data volume is first initialized
-- (per the official postgres image's `/docker-entrypoint-initdb.d/` contract).
-- Re-runs are no-ops because the volume persists and init scripts only fire
-- on a brand-new data directory.
--
-- The app DB (`effect-monorepo` / `effect-monorepo-test`) is auto-created by
-- the image from $POSTGRES_DB. Zitadel's DB is a peer database in the same
-- instance — see docs/dev-setup.md for the rationale (one container, two
-- databases, full namespace isolation between them).
CREATE DATABASE zitadel;
