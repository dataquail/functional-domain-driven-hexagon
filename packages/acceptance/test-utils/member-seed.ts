import { MEMBER_EMAIL, MEMBER_PASSWORD } from "./member-credentials";

// Provisions the acceptance "regular member" directly in Zitadel via the
// management API (using the bootstrap PAT, same auth path as
// admin-seed.ts). Unlike the admin, the member needs NO app-DB seeding:
// the auth `SignIn` command JIT-provisions an ordinary user (no
// `super_admin` role) on first login, which is exactly what we want.
//
// `_import` is the purpose-built endpoint for seeding a human with a known
// password: it marks the email verified and the password not-change-
// required in one call, so the hosted-login flow doesn't prompt for email
// verification or a forced password change. (An MFA-setup prompt may still
// appear on first login — the ZitadelLoginPage driver skips it.)
//
// Idempotent: re-running against an already-provisioned member (a local
// Zitadel volume that survives across runs) tolerates the "already
// exists" conflict.
export type SeedMemberParams = {
  readonly zitadelIssuer: string;
  readonly zitadelPat: string;
};

export const seedMemberInZitadel = async ({
  zitadelIssuer,
  zitadelPat,
}: SeedMemberParams): Promise<void> => {
  const response = await fetch(`${zitadelIssuer}/management/v1/users/human/_import`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${zitadelPat}`,
    },
    body: JSON.stringify({
      userName: MEMBER_EMAIL,
      profile: { firstName: "Member", lastName: "User" },
      email: { email: MEMBER_EMAIL, isEmailVerified: true },
      password: MEMBER_PASSWORD,
      passwordChangeRequired: false,
    }),
  });

  if (response.ok) return;

  // Already-provisioned is fine (idempotent re-run against a persistent
  // local Zitadel). Zitadel returns 409 AlreadyExists for a duplicate
  // username/email.
  const body = await response.text();
  if (response.status === 409 || body.includes("AlreadyExists")) return;

  throw new Error(
    `[acceptance/member-seed] failed to provision member ${MEMBER_EMAIL} in Zitadel: ` +
      `${response.status} ${response.statusText}\n${body}`,
  );
};
