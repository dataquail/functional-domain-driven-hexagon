// Credentials for the acceptance "regular member" — a non-super-admin used to
// exercise the org-scoped surfaces (todos, member roster) that super-admins
// can't reach. Seeded in global-setup, signed in by the `member-setup`
// project, and protected from the user-table truncate (see
// test-utils/database.ts).
export const MEMBER_EMAIL = process.env.ACCEPTANCE_MEMBER_EMAIL ?? "member@example.com";
export const MEMBER_PASSWORD = process.env.ACCEPTANCE_MEMBER_PASSWORD ?? "Password1!";

export const MEMBER_STORAGE_STATE = "playwright/.auth/member.json";
