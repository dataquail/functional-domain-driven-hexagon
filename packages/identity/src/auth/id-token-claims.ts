export type IdTokenClaimSource = {
  readonly user: { readonly email: string; readonly emailVerified: boolean };
  readonly scopes: ReadonlyArray<string>;
};

export type IdTokenEmailClaims = {
  readonly email?: string;
  readonly email_verified?: boolean;
};

// Better Auth serves email only at UserInfo; the server's relying party reads it off the id_token.
export const idTokenEmailClaims = ({ scopes, user }: IdTokenClaimSource): IdTokenEmailClaims => {
  if (!scopes.includes("email")) return {};

  return { email: user.email, email_verified: user.emailVerified };
};
