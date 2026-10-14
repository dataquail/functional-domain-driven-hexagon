// The acceptance super-admin. Seeded in the identity Worker and recorded in the
// test database by global-setup; protected from the user-table truncate.
export const ADMIN_EMAIL = process.env.IDENTITY_ADMIN_EMAIL ?? "admin@example.com";
export const ADMIN_PASSWORD = process.env.IDENTITY_ADMIN_PASSWORD ?? "ChangeMe!1";
