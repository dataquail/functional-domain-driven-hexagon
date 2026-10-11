import { seedIdentityUsers } from "@org/identity/seed/seed-client";

import { MEMBER_EMAIL, MEMBER_PASSWORD } from "./member-credentials";

// Seeds the regular member in the identity Worker with a verified email. No
// app-database row: the member's first sign-in provisions an ordinary user.
export const seedMember = async (): Promise<void> => {
  await seedIdentityUsers({
    env: process.env,
    users: [{ email: MEMBER_EMAIL, password: MEMBER_PASSWORD, name: "Member" }],
  });
};
