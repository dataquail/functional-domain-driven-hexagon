import type * as Effect from "effect/Effect";
import type { SqlClient } from "effect/sql/SqlClient";

import m0001 from "./0001_create_schema_user";
import m0002 from "./0002_create_schema_organization";
import m0003 from "./0003_create_schema_todos";
import m0004 from "./0004_create_schema_wallet";
import m0005 from "./0005_create_schema_auth";
import m0006 from "./0006_create_schema_platform";
import m0007 from "./0007_create_table_user_users";
import m0008 from "./0008_create_table_organization_organizations";
import m0009 from "./0009_create_table_todos_todos";
import m0010 from "./0010_create_table_wallet_wallets";
import m0011 from "./0011_create_table_organization_memberships";
import m0012 from "./0012_create_table_organization_invitations";
import m0013 from "./0013_create_table_organization_organization_roles";
import m0014 from "./0014_create_table_auth_auth_identities";
import m0015 from "./0015_create_table_auth_sessions";
import m0016 from "./0016_create_table_platform_roles";
import m0017 from "./0017_create_schema_billing";
import m0018 from "./0018_create_table_billing_subscriptions";
import m0019 from "./0019_create_table_billing_webhook_events";
import m0020 from "./0020_user_users_address_nullable";
import m0021 from "./0021_create_table_auth_api_tokens";
import m0022 from "./0022_create_table_auth_device_grants";
import m0023 from "./0023_create_table_platform_event_outbox";
import m0024 from "./0024_auth_identities_provider_better_auth";
import m0025 from "./0025_create_table_platform_mail_daily_counts";

// Statically imported rather than discovered on disk: the library's
// `fromFileSystem` loader marks its dynamic import `@vite-ignore`, so under
// vitest it bypasses the transform and Node cannot load a `.ts` migration. A
// record keeps one mechanism working for the CLI, the test suites and
// acceptance alike. `migrator.test.ts` asserts this list matches the directory.
export const migrations = {
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
  "0023_create_table_platform_event_outbox": m0023,
  "0024_auth_identities_provider_better_auth": m0024,
  "0025_create_table_platform_mail_daily_counts": m0025,
} satisfies Record<string, Effect.Effect<void, unknown, SqlClient>>;
