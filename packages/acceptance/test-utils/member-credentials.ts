// Credentials for the acceptance "regular member" — a non-super-admin
// Zitadel user used to exercise the org-scoped surfaces (todos, member
// roster) that super-admins can't reach. Provisioned in global-setup,
// logged in by the `member-setup` project, and protected from the
// user-table truncate (see test-utils/database.ts). Defaults keep CI
// from needing extra secrets; override via env if your Zitadel password
// policy differs.
export const MEMBER_EMAIL = process.env.ACCEPTANCE_MEMBER_EMAIL ?? "member@example.com";
export const MEMBER_PASSWORD = process.env.ACCEPTANCE_MEMBER_PASSWORD ?? "Password1!";

export const MEMBER_STORAGE_STATE = "playwright/.auth/member.json";
