import type * as Effect from "effect/Effect";
import type { SqlClient } from "effect/unstable/sql/SqlClient";

import m0001 from "./0001_create_schema_user.js";
import m0002 from "./0002_create_schema_organization.js";
import m0003 from "./0003_create_schema_todos.js";
import m0004 from "./0004_create_schema_wallet.js";
import m0005 from "./0005_create_schema_auth.js";
import m0006 from "./0006_create_schema_platform.js";
import m0007 from "./0007_create_table_user_users.js";
import m0008 from "./0008_create_table_organization_organizations.js";
import m0009 from "./0009_create_table_todos_todos.js";
import m0010 from "./0010_create_table_wallet_wallets.js";
import m0011 from "./0011_create_table_organization_memberships.js";
import m0012 from "./0012_create_table_organization_invitations.js";
import m0013 from "./0013_create_table_organization_organization_roles.js";
import m0014 from "./0014_create_table_auth_auth_identities.js";
import m0015 from "./0015_create_table_auth_sessions.js";
import m0016 from "./0016_create_table_platform_roles.js";
import m0017 from "./0017_create_schema_billing.js";
import m0018 from "./0018_create_table_billing_subscriptions.js";
import m0019 from "./0019_create_table_billing_webhook_events.js";
import m0020 from "./0020_user_users_address_nullable.js";
import m0021 from "./0021_create_table_auth_api_tokens.js";
import m0022 from "./0022_create_table_auth_device_grants.js";

// Statically imported rather than discovered on disk: the library's
// `fromFileSystem` loader marks its dynamic import `@vite-ignore`, so under
// vitest it bypasses the transform and Node cannot load a `.ts` migration. A
// record keeps one mechanism working for the CLI, the test suites and
// acceptance alike. `migrator.test.ts` asserts this list matches the directory.
export const migrations: Record<string, Effect.Effect<void, unknown, SqlClient>> = {
  "0001_create_schema_user": m0001,
  "0002_create_schema_organization": m0002,
  "0003_create_schema_todos": m0003,
  "0004_create_schema_wallet": m0004,
  "0005_create_schema_auth": m0005,
  "0006_create_schema_platform": m0006,
  "0007_create_table_user_users": m0007,
  "0008_create_table_organization_organizations": m0008,
  "0009_create_table_todos_todos": m0009,
  "0010_create_table_wallet_wallets": m0010,
  "0011_create_table_organization_memberships": m0011,
  "0012_create_table_organization_invitations": m0012,
  "0013_create_table_organization_organization_roles": m0013,
  "0014_create_table_auth_auth_identities": m0014,
  "0015_create_table_auth_sessions": m0015,
  "0016_create_table_platform_roles": m0016,
  "0017_create_schema_billing": m0017,
  "0018_create_table_billing_subscriptions": m0018,
  "0019_create_table_billing_webhook_events": m0019,
  "0020_user_users_address_nullable": m0020,
  "0021_create_table_auth_api_tokens": m0021,
  "0022_create_table_auth_device_grants": m0022,
};
